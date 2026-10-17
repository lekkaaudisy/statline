-- Slice 2: onboarding. Adds the onboarding choices to profiles, and creates
-- onboarding_answers and stats. Users can read their own rows but cannot write
-- them directly: everything is saved through complete_onboarding() below,
-- which checks the data and saves it all at once.
--
-- Some numbers here repeat lib/game/constants.ts as a safety net
-- (15/30/60 minutes, 120-character goals, grade points). Keep them in step.

-- 1. Onboarding choices on the profile -------------------------------------

alter table public.profiles
  add column main_class text
    check (main_class in ('fighter', 'scholar', 'builder', 'professional', 'monk', 'leader')),
  add column second_class text
    check (second_class in ('fighter', 'scholar', 'builder', 'professional', 'monk', 'leader')),
  add column goal text
    check (char_length(goal) between 1 and 120),
  add column daily_minutes smallint
    check (daily_minutes in (15, 30, 60)),
  -- Empty until onboarding is finished. Used to show onboarding only once.
  add column onboarded_at timestamptz,
  add constraint profiles_second_class_differs
    check (second_class is null or second_class <> main_class);

-- 2. Behaviour question answers -------------------------------------------

create table public.onboarding_answers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 10),
  -- The chosen option, 0 (lowest) to 3 (highest).
  answer smallint not null check (answer between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.onboarding_answers enable row level security;

create policy "Users can read their own onboarding answers"
  on public.onboarding_answers for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.onboarding_answers from anon, authenticated;

-- 3. Stats: one row per user per stat --------------------------------------

create table public.stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  stat text not null
    check (stat in ('strength', 'speed', 'endurance', 'intelligence', 'potential')),
  points integer not null default 0 check (points >= 0),
  -- Highest grade ever reached, used as the decay floor (Slice 3).
  -- Stays empty while grades are provisional.
  best_grade text
    check (best_grade in ('F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS')),
  -- True until the calibration week settles the grade (Slice 6).
  provisional boolean not null default true,
  last_active_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, stat)
);

alter table public.stats enable row level security;

create policy "Users can read their own stats"
  on public.stats for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.stats from anon, authenticated;

create trigger stats_set_updated_at
  before update on public.stats
  for each row execute function public.set_updated_at();

-- 4. Finishing onboarding ---------------------------------------------------
-- Called by the app once, at the end of onboarding. The app works out the
-- grades (lib/game/onboarding.ts) and sends the points. This function saves
-- everything in one go, so a failure saves nothing, and it refuses:
--   - a second onboarding,
--   - anything other than exactly 8 answers and 5 stats,
--   - any stat above B (110 points), the cap for self-reported grades,
--   - Potential at anything but C (75 points).

create function public.complete_onboarding(
  p_main_class text,
  p_second_class text,
  p_goal text,
  p_daily_minutes smallint,
  p_answers jsonb, -- {"S1": 2, "S2": 1, ...}
  p_points jsonb   -- {"strength": 75, "speed": 45, ...}
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;

  update public.profiles
     set main_class = p_main_class,
         second_class = p_second_class,
         goal = p_goal,
         daily_minutes = p_daily_minutes,
         onboarded_at = now()
   where id = uid and onboarded_at is null;
  if not found then
    raise exception 'Onboarding is already complete';
  end if;

  insert into public.onboarding_answers (user_id, question_id, answer)
  select uid, key, value::smallint from jsonb_each_text(p_answers);

  insert into public.stats (user_id, stat, points, provisional)
  select uid, key, value::integer, true from jsonb_each_text(p_points);

  if (select count(*) from public.onboarding_answers where user_id = uid) <> 8 then
    raise exception 'Expected 8 answers';
  end if;
  if (select count(*) from public.stats where user_id = uid) <> 5 then
    raise exception 'Expected 5 stats';
  end if;
  if exists (select 1 from public.stats where user_id = uid and points > 110) then
    raise exception 'Self-reported grades are capped at B';
  end if;
  if (select points from public.stats where user_id = uid and stat = 'potential') <> 75 then
    raise exception 'Potential starts at C';
  end if;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, text, smallint, jsonb, jsonb)
  from public, anon;
grant execute on function public.complete_onboarding(text, text, text, smallint, jsonb, jsonb)
  to authenticated;
