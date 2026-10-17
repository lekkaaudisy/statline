-- Slice 6: calibration week and Awakening. Adds placement quests, the
-- calibrations table, activity_days (for Awakening), the awakened_on date on
-- profiles, and the functions that settle calibration and give Awakening.
--
-- Users can read their own rows but cannot write them directly. Everything
-- goes through the functions below, which check the rules again.
--
-- Some numbers here repeat lib/game/constants.ts as a safety net (7 days,
-- 5/6/7 placement quests, placement ranks 1 to 4, one step per settlement,
-- 84-day seasons, 7 inactive days, 12 active days in 14, a 10-point boost,
-- Bronze Day One and Platinum Exclusive cards). Keep them in step.

-- 1. Helpers -----------------------------------------------------------------

-- Points at the bottom of a grade step (0 = F ... 8 = SSS).
create function public.grade_points(p_step integer) returns integer
language sql immutable set search_path = '' as $$
  select (array[0, 20, 45, 75, 110, 150, 200, 260, 330])[p_step + 1];
$$;

revoke execute on function public.grade_points(integer) from public, anon, authenticated;

-- 2. Placement quests ----------------------------------------------------------
-- A new quest type. Placement quests use slots 1 to 7 (their number in the
-- calibration week); other System quests keep slots 1 to 3.

alter table public.quests drop constraint quests_type_check;
alter table public.quests add constraint quests_type_check
  check (type in ('daily', 'main', 'side', 'skill', 'placement'));

alter table public.quests drop constraint quests_slot_check;
alter table public.quests add constraint quests_slot_check
  check (slot between 1 and 7 and (type = 'placement' or slot <= 3));

-- 3. Calibrations ----------------------------------------------------------------
-- One row per calibration week: the first after onboarding, then at most one
-- recalibration per season. `results` holds each stat's grade before and
-- after, for the result screen.

create table public.calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('first', 'recalibration')),
  started_on date not null,
  settled_on date,
  results jsonb,
  created_at timestamptz not null default now(),
  constraint calibrations_settled_after_start
    check (settled_on is null or settled_on >= started_on + 7)
);

create index calibrations_user_started on public.calibrations (user_id, started_on desc);

-- At most one calibration running at a time.
create unique index calibrations_one_open
  on public.calibrations (user_id) where settled_on is null;

alter table public.calibrations enable row level security;

create policy "Users can read their own calibrations"
  on public.calibrations for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.calibrations from anon, authenticated;

-- Players who finished onboarding before this slice: their calibration
-- started on their onboarding day. Anyone already marked calibrated (with
-- the developer tools) counts as settled, with no results to show.
insert into public.calibrations (user_id, kind, started_on, settled_on)
select p.id, 'first', p.onboarded_at::date,
       case when exists (select 1 from public.stats s
                          where s.user_id = p.id and s.stat <> 'potential'
                            and not s.provisional)
            then greatest(current_date, p.onboarded_at::date + 7) end
  from public.profiles p
 where p.onboarded_at is not null;

-- 4. Active days ------------------------------------------------------------------
-- One row per day the user cleared a quest or took a rest day. Used to
-- detect Awakening. Filled in automatically when a quest proof or a rest day
-- is saved.

create table public.activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

alter table public.activity_days enable row level security;

create policy "Users can read their own active days"
  on public.activity_days for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.activity_days from anon, authenticated;

create function public.record_quest_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_days (user_id, day)
  values (new.user_id, new.created_at::date)
  on conflict do nothing;
  return new;
end;
$$;

create function public.record_rest_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_days (user_id, day)
  values (new.user_id, new.rest_on)
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.record_quest_activity() from public, anon, authenticated;
revoke execute on function public.record_rest_activity() from public, anon, authenticated;

create trigger quest_proofs_record_activity
  after insert on public.quest_proofs
  for each row execute function public.record_quest_activity();

create trigger rest_days_record_activity
  after insert on public.rest_days
  for each row execute function public.record_rest_activity();

-- Past activity, from quests already cleared and rest days already taken.
insert into public.activity_days (user_id, day)
select user_id, created_at::date from public.quest_proofs
union
select user_id, rest_on from public.rest_days
on conflict do nothing;

-- 5. Awakening and Proof cards --------------------------------------------------------

-- The day the user awakened. Empty until then. Once per account in the MVP.
alter table public.profiles add column awakened_on date;

-- One Day One card and one Exclusive card per account.
create unique index cards_one_day_one on public.cards (user_id) where kind = 'day_one';
create unique index cards_one_exclusive on public.cards (user_id) where kind = 'exclusive';

-- 6. Onboarding now starts the calibration week ------------------------------------------
-- Same as before, plus the first calibration row.

create or replace function public.complete_onboarding(
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

  insert into public.calibrations (user_id, kind, started_on)
  values (uid, 'first', current_date);
end;
$$;

-- 7. Issuing placement quests ------------------------------------------------------------
-- The app builds them (lib/game/calibration.ts). This checks: a calibration
-- week is running, the slot's day has come (one a day, 5/6/7 in total by
-- daily time), rank 1 to 4 with the matching points and proofs, and each
-- slot is given once per calibration. All stay open until day 7.

create function public.issue_placement_quests(p_quests jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cal public.calibrations%rowtype;
  total integer;
  today_number integer;
  q record;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select * into cal from public.calibrations
   where user_id = uid and settled_on is null;
  if not found or current_date not between cal.started_on and cal.started_on + 6 then
    raise exception 'No calibration week is running';
  end if;
  select case daily_minutes when 15 then 5 when 30 then 6 when 60 then 7 end
    into total from public.profiles where id = uid;
  today_number := current_date - cal.started_on + 1;

  for q in
    select * from jsonb_to_recordset(p_quests) as x(
      type text, template_id text, title text, stat text,
      difficulty_rank integer, gain integer, minutes integer,
      counts_for_class boolean, allowed_proofs text[], slot integer)
  loop
    if q.type is distinct from 'placement' or q.template_id not like 'placement-%' then
      raise exception 'Only placement quests can be issued here';
    end if;
    if coalesce(q.slot not between 1 and least(total, today_number), true) then
      raise exception 'That placement quest is not due yet';
    end if;
    if q.difficulty_rank not between 1 and 4
       or q.gain is distinct from public.quest_gain(q.difficulty_rank, 'placement') then
      raise exception 'Quest rank or points do not match';
    end if;
    if q.allowed_proofs is distinct from array['evidence', 'honour'] then
      raise exception 'Quest proof types do not match its rank';
    end if;
    continue when exists (
      select 1 from public.quests
       where user_id = uid and type = 'placement' and slot = q.slot
         and issued_on >= cal.started_on);

    insert into public.quests (
      user_id, type, source, template_id, title, stat, difficulty_rank, gain,
      minutes, counts_for_class, allowed_proofs, slot, issued_on, due_on)
    values (
      uid, 'placement', 'system', q.template_id, q.title, q.stat, q.difficulty_rank,
      q.gain, q.minutes, coalesce(q.counts_for_class, false), q.allowed_proofs,
      q.slot, current_date, cal.started_on + 6)
    on conflict (user_id, issued_on, type, slot)
      where source = 'system' and status <> 'rerolled'
    do nothing;
  end loop;
end;
$$;

revoke execute on function public.issue_placement_quests(jsonb) from public, anon;
grant execute on function public.issue_placement_quests(jsonb) to authenticated;

-- 8. Settling calibration ------------------------------------------------------------------
-- The app works out each grade from the week's proof (lib/game/calibration.ts)
-- and sends the new points. This checks the week is over and each stat
-- moves at most one grade step, with points exactly where the rules put
-- them: the bottom of a higher grade, the top of a lower one, or unchanged.
-- Then grades stop being provisional, the decay clock starts today, and the
-- first calibration gives the Day One Proof card.

create function public.settle_calibration(
  p_results jsonb -- {"strength": {"points": 110, "score": 0.8, "counted": 2}, ...}
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  grades constant text[] := array['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  uid uuid := auth.uid();
  cal public.calibrations%rowtype;
  s record;
  entry jsonb;
  new_points integer;
  old_step integer;
  new_step integer;
  saved jsonb := '{}'::jsonb;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select * into cal from public.calibrations
   where user_id = uid and settled_on is null for update;
  if not found then
    raise exception 'There is no calibration to settle';
  end if;
  if current_date < cal.started_on + 7 then
    raise exception 'The calibration week is not over yet';
  end if;
  if (select count(*) from jsonb_object_keys(p_results)) <> 4
     or exists (select 1 from jsonb_object_keys(p_results) as k(stat)
                 where k.stat not in ('strength', 'speed', 'endurance', 'intelligence')) then
    raise exception 'Expected the four earned stats';
  end if;

  for s in
    select stat, points, best_grade from public.stats
     where user_id = uid and stat in ('strength', 'speed', 'endurance', 'intelligence')
       for update
  loop
    entry := p_results -> s.stat;
    new_points := (entry ->> 'points')::integer;
    old_step := public.grade_step(s.points);
    new_step := public.grade_step(new_points);
    if new_points is null
       or abs(new_step - old_step) > 1
       or (new_step > old_step and new_points <> public.grade_points(new_step))
       or (new_step < old_step and new_points <> public.grade_points(old_step) - 1)
       or (new_step = old_step and new_points <> s.points) then
      raise exception 'Calibration results do not match the saved stats';
    end if;

    update public.stats
       set points = new_points,
           provisional = false,
           best_grade = grades[greatest(coalesce(array_position(grades, s.best_grade), 1),
                                        new_step + 1)],
           last_active_on = current_date
     where user_id = uid and stat = s.stat;

    saved := saved || jsonb_build_object(s.stat, jsonb_build_object(
      'before', grades[old_step + 1],
      'after', grades[new_step + 1],
      'points', new_points,
      'score', case when jsonb_typeof(entry -> 'score') = 'number'
                    then least(greatest((entry ->> 'score')::numeric, 0), 1) end,
      'counted', case when jsonb_typeof(entry -> 'counted') = 'number'
                      then least(greatest((entry ->> 'counted')::integer, 0), 100) else 0 end));
  end loop;

  update public.stats set provisional = false where user_id = uid and stat = 'potential';
  update public.calibrations set settled_on = current_date, results = saved where id = cal.id;

  if cal.kind = 'first' then
    insert into public.cards (user_id, kind, tier, status, source)
    values (uid, 'day_one', 'Bronze', 'held', 'calibration')
    on conflict (user_id) where kind = 'day_one' do nothing;
  end if;
end;
$$;

revoke execute on function public.settle_calibration(jsonb) from public, anon;
grant execute on function public.settle_calibration(jsonb) to authenticated;

-- 9. Recalibration ---------------------------------------------------------------------------
-- Once per season (84 days after the last calibration started), never while
-- one is running. Saves any decay so far (the app sends the points after
-- decay; they can only be lower), makes the four earned grades provisional
-- again and starts a new calibration week today.

create function public.start_recalibration(
  p_points jsonb -- {"strength": 80, ...} after decay
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  last public.calibrations%rowtype;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select * into last from public.calibrations
   where user_id = uid order by started_on desc limit 1;
  if not found or last.settled_on is null then
    raise exception 'Finish your calibration week first';
  end if;
  if current_date < last.started_on + 84 then
    raise exception 'Recalibration is allowed once per season';
  end if;

  update public.stats s
     set points = least(s.points, greatest((p_points ->> s.stat)::integer, 0)),
         provisional = true
   where s.user_id = uid
     and s.stat in ('strength', 'speed', 'endurance', 'intelligence')
     and p_points ? s.stat;
  if (select count(*) from public.stats
       where user_id = uid and provisional
         and stat in ('strength', 'speed', 'endurance', 'intelligence')) <> 4 then
    raise exception 'Expected the four earned stats';
  end if;

  insert into public.calibrations (user_id, kind, started_on)
  values (uid, 'recalibration', current_date);
end;
$$;

revoke execute on function public.start_recalibration(jsonb) from public, anon;
grant execute on function public.start_recalibration(jsonb) to authenticated;

-- 10. Awakening ---------------------------------------------------------------------------------
-- The app detects it (lib/game/awakening.ts) and sends each earned stat's
-- points after decay plus the 10-point boost. This checks it again from
-- activity_days: 7 inactive days in a row since onboarding, then a later
-- 14-day window with at least 12 active days, ending today at the latest.
-- Then it adds the boost, gives the Exclusive Proof card, and records the day.

create function public.awaken(
  p_points jsonb -- {"strength": 85, ...} after decay plus the boost
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  started date;
  awakened date;
  gap_end date;
  stat_name text;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select onboarded_at::date, awakened_on into started, awakened
    from public.profiles where id = uid for update;
  if started is null then
    raise exception 'Finish onboarding first';
  end if;
  if awakened is not null then
    raise exception 'Awakening has already happened';
  end if;

  select min(d.day)::date into gap_end
    from generate_series(started + 6, current_date, interval '1 day') as d(day)
   where not exists (
     select 1 from public.activity_days a
      where a.user_id = uid and a.day between d.day::date - 6 and d.day::date);
  if gap_end is null or not exists (
       select 1
         from generate_series(gap_end + 1, current_date - 13, interval '1 day') as w(day)
        where (select count(*) from public.activity_days a
                where a.user_id = uid
                  and a.day between w.day::date and w.day::date + 13) >= 12) then
    raise exception 'Awakening has not happened yet';
  end if;

  foreach stat_name in array array['strength', 'speed', 'endurance', 'intelligence'] loop
    if (p_points ->> stat_name) is null then
      raise exception 'Expected the four earned stats';
    end if;
    perform public.award_stat_points(uid, stat_name, (p_points ->> stat_name)::integer, 10);
  end loop;

  insert into public.cards (user_id, kind, tier, status, source)
  values (uid, 'exclusive', 'Platinum', 'held', 'awakening')
  on conflict (user_id) where kind = 'exclusive' do nothing;

  update public.profiles set awakened_on = current_date where id = uid;
end;
$$;

revoke execute on function public.awaken(jsonb) from public, anon;
grant execute on function public.awaken(jsonb) to authenticated;

-- 11. Developer tools ------------------------------------------------------------------------------

-- Pretend a day has passed: as before, plus calibration dates, the
-- onboarding day, the Awakening day and active days.
create or replace function public.dev_pass_day() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;

  -- Quests and active days move in two steps (far ahead, then back to one
  -- day earlier), so no two rows ever share a key on the way.
  update public.quests
     set issued_on = issued_on + 100000, due_on = due_on + 100000
   where user_id = uid;
  update public.quests
     set issued_on = issued_on - 100001,
         due_on = due_on - 100001,
         completed_at = completed_at - interval '1 day'
   where user_id = uid;
  update public.activity_days set day = day + 100000 where user_id = uid;
  update public.activity_days set day = day - 100001 where user_id = uid;
  update public.rest_days set rest_on = rest_on - 1 where user_id = uid;
  update public.stats set last_active_on = last_active_on - 1 where user_id = uid;
  update public.cards set activated_on = activated_on - 1 where user_id = uid;
  update public.calibrations
     set started_on = started_on - 1, settled_on = settled_on - 1
   where user_id = uid;
  update public.profiles
     set difficulty_checked_on = difficulty_checked_on - 1,
         sick_since = sick_since - 1,
         onboarded_at = onboarded_at - interval '1 day',
         awakened_on = awakened_on - 1
   where id = uid;
end;
$$;

-- Passes several days at once. Steady days are marked active before they
-- pass (as if a quest was cleared); idle days are not.
create function public.dev_pass_days(p_days integer, p_steady boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;
  if p_days not between 1 and 30 then
    raise exception 'Pass 1 to 30 days at a time';
  end if;
  for i in 1..p_days loop
    if p_steady then
      insert into public.activity_days (user_id, day) values (uid, current_date)
      on conflict do nothing;
    end if;
    perform public.dev_pass_day();
  end loop;
end;
$$;

revoke execute on function public.dev_pass_days(integer, boolean) from public, anon;
grant execute on function public.dev_pass_days(integer, boolean) to authenticated;

-- Starts the first calibration week again from today: removes calibrations,
-- placement quests and the Day One card, and makes grades provisional.
create function public.dev_restart_calibration() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;
  delete from public.quests where user_id = uid and type = 'placement';
  delete from public.cards where user_id = uid and kind = 'day_one';
  delete from public.calibrations where user_id = uid;
  update public.stats set provisional = true, best_grade = null where user_id = uid;
  insert into public.calibrations (user_id, kind, started_on)
  values (uid, 'first', current_date);
end;
$$;

revoke execute on function public.dev_restart_calibration() from public, anon;
grant execute on function public.dev_restart_calibration() to authenticated;

-- Makes Awakening possible again: clears the Awakening day, the Exclusive
-- card and all active days.
create function public.dev_reset_awakening() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;
  update public.profiles set awakened_on = null where id = uid;
  delete from public.cards where user_id = uid and kind = 'exclusive';
  delete from public.activity_days where user_id = uid;
end;
$$;

revoke execute on function public.dev_reset_awakening() from public, anon;
grant execute on function public.dev_reset_awakening() to authenticated;
