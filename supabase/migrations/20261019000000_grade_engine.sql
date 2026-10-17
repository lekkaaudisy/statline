-- Slice 3: grade engine. Adds the sick-or-injured flag, weekly stat history
-- (used for Potential), and developer-only tools for testing grades.
--
-- Some numbers here repeat lib/game/constants.ts as a safety net (the grade
-- thresholds). Keep them in step.

-- 1. Sick or injured --------------------------------------------------------
-- The day the user set "Sick or injured", or empty if they are well. While
-- set, decay is paused. Not in the profiles update grant: it changes only
-- through functions.

alter table public.profiles add column sick_since date;

-- 2. Grade helper -----------------------------------------------------------
-- The grade step (0 = F ... 8 = SSS) that the points reach.

create function public.grade_step(p_points integer) returns integer
language sql immutable set search_path = '' as $$
  select count(*)::integer - 1
    from unnest(array[0, 20, 45, 75, 110, 150, 200, 260, 330]) as t(threshold)
   where t.threshold <= greatest(p_points, 0);
$$;

revoke execute on function public.grade_step(integer) from public, anon, authenticated;

-- 3. Weekly stat history ------------------------------------------------------
-- One snapshot per user per week (weeks start on Monday). Potential is worked
-- out from the trend, and the crew leaderboard will use it later.

create table public.stat_history (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  strength integer not null check (strength >= 0),
  speed integer not null check (speed >= 0),
  endurance integer not null check (endurance >= 0),
  intelligence integer not null check (intelligence >= 0),
  potential integer not null check (potential >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.stat_history enable row level security;

create policy "Users can read their own stat history"
  on public.stat_history for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.stat_history from anon, authenticated;

-- 4. Recording the week -------------------------------------------------------
-- Called by the status window on the first visit of each week. Saves this
-- week's snapshot and the new Potential in one go. Returns false (and changes
-- nothing) if this week is already saved. It refuses:
--   - a week start that is not this week's Monday,
--   - stat points above the saved points (decay can only lower them),
--   - a Potential that is not a grade's starting points, or that moves more
--     than one grade step.

create function public.record_week(
  p_week_start date,
  p_points jsonb,            -- {"strength": 80, "speed": 45, ...} after decay
  p_potential_points integer -- the new Potential, e.g. 110 for B
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_potential integer;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;

  if extract(isodow from p_week_start) <> 1
     or p_week_start > current_date
     or p_week_start <= current_date - 7 then
    raise exception 'Week start must be this week''s Monday';
  end if;

  if (select count(*) from public.stats s
       where s.user_id = uid
         and s.stat <> 'potential'
         and (p_points ->> s.stat)::integer between 0 and s.points) <> 4 then
    raise exception 'Stat points do not match the saved stats';
  end if;

  select points into current_potential
    from public.stats where user_id = uid and stat = 'potential';
  if current_potential is null then
    raise exception 'Expected a Potential stat';
  end if;
  if p_potential_points not in (0, 20, 45, 75, 110, 150, 200, 260, 330)
     or abs(public.grade_step(p_potential_points)
            - public.grade_step(current_potential)) > 1 then
    raise exception 'Potential moves at most one grade a week';
  end if;

  insert into public.stat_history
    (user_id, week_start, strength, speed, endurance, intelligence, potential)
  values (
    uid, p_week_start,
    (p_points ->> 'strength')::integer,
    (p_points ->> 'speed')::integer,
    (p_points ->> 'endurance')::integer,
    (p_points ->> 'intelligence')::integer,
    p_potential_points
  )
  on conflict (user_id, week_start) do nothing;
  if not found then
    return false;
  end if;

  update public.stats set points = p_potential_points
   where user_id = uid and stat = 'potential';
  return true;
end;
$$;

revoke execute on function public.record_week(date, jsonb, integer) from public, anon;
grant execute on function public.record_week(date, jsonb, integer) to authenticated;

-- 5. Developer tools ----------------------------------------------------------
-- Only accounts listed here can use dev_save(). The app cannot add anyone:
-- add your own account by hand in the Supabase SQL editor:
--   insert into public.dev_testers (user_id)
--   select id from auth.users where email = 'you@example.com';

create table public.dev_testers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.dev_testers enable row level security;

-- Lets the app check whether to show the developer panel.
create policy "Users can see whether they are a dev tester"
  on public.dev_testers for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.dev_testers from anon, authenticated;

-- Saves test changes to the four earned stats and the sick flag. Potential
-- can never be set here: it is only ever worked out from the trend.

create function public.dev_save(
  p_stats jsonb, -- {"strength": {"points": 80, "best_grade": "C",
                 --   "last_active_on": "2026-10-17", "provisional": false}, ...}
  p_sick_since date
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;

  if exists (select 1 from jsonb_object_keys(p_stats) as k(stat)
              where k.stat not in ('strength', 'speed', 'endurance', 'intelligence')) then
    raise exception 'Only the four earned stats can be changed';
  end if;

  update public.stats s
     set points = (e.value ->> 'points')::integer,
         best_grade = e.value ->> 'best_grade',
         last_active_on = (e.value ->> 'last_active_on')::date,
         provisional = (e.value ->> 'provisional')::boolean
    from jsonb_each(p_stats) as e(stat, value)
   where s.user_id = uid and s.stat = e.stat;

  update public.profiles set sick_since = p_sick_since where id = uid;
end;
$$;

revoke execute on function public.dev_save(jsonb, date) from public, anon;
grant execute on function public.dev_save(jsonb, date) to authenticated;
