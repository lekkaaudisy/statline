-- Slice 4: quests. Adds quests, quest_proofs and rest_days, the difficulty
-- rank on profiles, and a private storage bucket for proof photos.
--
-- Users can read their own rows but cannot write them directly. Everything
-- goes through the functions below, which check the rules again.
--
-- Some numbers here repeat lib/game/constants.ts as a safety net (gains per
-- rank, proof weights, the honour limit, quest counts, strength caps, rest
-- day points, side quest limits). Keep them in step.

-- 1. Difficulty rank on the profile ----------------------------------------
-- Ranks 6 and 7 are not used in the MVP. Changed only by set_difficulty().

alter table public.profiles
  add column difficulty_rank smallint not null default 2
    check (difficulty_rank between 1 and 5),
  -- The day the rank was last checked (it is checked once a week).
  add column difficulty_checked_on date;

-- 2. Helpers -----------------------------------------------------------------

-- Stat points a quest gives at a rank (main quests give 3 times more).
create function public.quest_gain(p_rank integer, p_type text) returns integer
language sql immutable set search_path = '' as $$
  select (array[4, 6, 9, 12, 15])[p_rank]
         * case when p_type = 'main' then 3 else 1 end;
$$;

-- Quests a day for each daily time choice (15, 30 or 60 minutes).
create function public.daily_quest_count(p_minutes integer) returns integer
language sql immutable set search_path = '' as $$
  select case p_minutes when 15 then 1 when 30 then 2 when 60 then 3 else 0 end;
$$;

revoke execute on function public.quest_gain(integer, text) from public, anon, authenticated;
revoke execute on function public.daily_quest_count(integer) from public, anon, authenticated;

-- 3. Quests --------------------------------------------------------------------

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('daily', 'main', 'side', 'skill')),
  source text not null check (source in ('system', 'user')),
  -- The library template it came from. Empty for the user's own quests.
  template_id text check (char_length(template_id) between 1 and 40),
  title text not null check (char_length(title) between 1 and 200),
  -- Potential is never earned directly, so it is never a quest stat.
  stat text not null
    check (stat in ('strength', 'speed', 'endurance', 'intelligence')),
  difficulty_rank smallint not null check (difficulty_rank between 1 and 5),
  gain smallint not null check (gain > 0),
  minutes smallint check (minutes between 5 and 120),
  -- True for Class quests, used for the 60/40 rule.
  counts_for_class boolean not null default false,
  allowed_proofs text[] not null
    check (allowed_proofs <@ array['auto', 'crew', 'evidence', 'honour']
           and cardinality(allowed_proofs) > 0),
  -- System quests: the position on its day (dailies 1 to 3, side 1, main 1).
  slot smallint check (slot between 1 and 3),
  issued_on date not null,
  due_on date not null,
  -- open: can be done. cleared: done with proof. missed: past due.
  -- rested: a daily on the rest day. excused: missed while sick or injured.
  status text not null default 'open'
    check (status in ('open', 'cleared', 'missed', 'rested', 'excused')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  -- Honour proof is never allowed for rank 5 and above.
  constraint quests_honour_limit
    check (difficulty_rank <= 4 or not ('honour' = any (allowed_proofs))),
  constraint quests_due_after_issue check (due_on >= issued_on),
  constraint quests_system_fields check (
    (source = 'system' and template_id is not null and slot is not null)
    or (source = 'user' and template_id is null and slot is null)
  ),
  -- A strength quest never asks for more than 30 minutes.
  constraint quests_strength_minutes
    check (stat <> 'strength' or minutes is null or minutes <= 30)
);

-- The System gives each quest slot only once, so loading the page twice
-- never creates duplicates.
create unique index quests_one_per_slot
  on public.quests (user_id, issued_on, type, slot)
  where source = 'system';

create index quests_user_issued on public.quests (user_id, issued_on desc);

alter table public.quests enable row level security;

create policy "Users can read their own quests"
  on public.quests for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.quests from anon, authenticated;

-- 4. Proofs --------------------------------------------------------------------

create table public.quest_proofs (
  quest_id uuid primary key references public.quests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  proof_type text not null check (proof_type in ('auto', 'crew', 'evidence', 'honour')),
  -- A photo in the user's own folder of the quest-proofs bucket.
  photo_path text check (char_length(photo_path) between 1 and 200),
  summary text check (char_length(summary) between 1 and 500),
  -- The crewmate who confirmed it (Crew-lite, Slice 7).
  confirmed_by uuid references public.profiles (id) on delete set null,
  points_awarded smallint not null check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  constraint quest_proofs_evidence_attached
    check (proof_type <> 'evidence' or photo_path is not null or summary is not null),
  constraint quest_proofs_photo_in_own_folder
    check (photo_path is null or photo_path like user_id::text || '/%')
);

alter table public.quest_proofs enable row level security;

create policy "Users can read their own quest proofs"
  on public.quest_proofs for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.quest_proofs from anon, authenticated;

-- 5. Rest days -------------------------------------------------------------------
-- One per week (Monday to Sunday), checked by take_rest_day().

create table public.rest_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  rest_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, rest_on)
);

alter table public.rest_days enable row level security;

create policy "Users can read their own rest days"
  on public.rest_days for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.rest_days from anon, authenticated;

-- 6. Proof photo storage -----------------------------------------------------------
-- Private: no public links. Each user can only upload to, read and delete
-- from their own folder ("<user id>/..."). Photos are shown through
-- short-lived signed links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quest-proofs', 'quest-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);

create policy "Users can upload their own proof photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'quest-proofs'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can read their own proof photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'quest-proofs'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own proof photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'quest-proofs'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 7. Awarding points (internal) ---------------------------------------------------
-- Saves a stat's new points after a quest or the rest day. The app works out
-- the new points (any decay so far, plus the award) with lib/game; this
-- checks they are no more than the saved points plus the award, keeps the
-- best grade, and marks the stat active today.

create function public.award_stat_points(
  p_user_id uuid,
  p_stat text,
  p_new_points integer,
  p_awarded integer
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  grades constant text[] := array['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  current_points integer;
  current_best text;
  is_provisional boolean;
begin
  select points, best_grade, provisional
    into current_points, current_best, is_provisional
    from public.stats
   where user_id = p_user_id and stat = p_stat
     for update;
  if not found then
    raise exception 'Expected a % stat', p_stat;
  end if;

  if p_new_points < p_awarded or p_new_points > current_points + p_awarded then
    raise exception 'Stat points do not match the saved stats';
  end if;

  update public.stats
     set points = p_new_points,
         best_grade = case
           when is_provisional then best_grade
           else grades[greatest(coalesce(array_position(grades, current_best), 1),
                                public.grade_step(p_new_points) + 1)]
         end,
         last_active_on = current_date
   where user_id = p_user_id and stat = p_stat;
end;
$$;

revoke execute on function public.award_stat_points(uuid, text, integer, integer)
  from public, anon, authenticated;

-- 8. Closing overdue quests ----------------------------------------------------------
-- Called when the quest list opens. Open quests past their due day become
-- missed, or excused if the user was sick or injured by then. No penalty
-- here: the failed main quest penalty arrives with cards (Slice 5).

create function public.close_overdue_quests() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sick date;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select sick_since into sick from public.profiles where id = uid;

  update public.quests
     set status = case when sick is not null and due_on >= sick
                       then 'excused' else 'missed' end
   where user_id = uid and status = 'open' and due_on < current_date;
end;
$$;

revoke execute on function public.close_overdue_quests() from public, anon;
grant execute on function public.close_overdue_quests() to authenticated;

-- 9. Weekly difficulty ---------------------------------------------------------------
-- The app works out the new rank from the last 14 days (lib/game/difficulty.ts).
-- This refuses a change of more than one step, or a second check in a week.

create function public.set_difficulty(p_rank integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_rank integer;
  checked date;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select difficulty_rank, difficulty_checked_on into current_rank, checked
    from public.profiles where id = uid for update;

  if checked is not null and checked >= date_trunc('week', current_date)::date then
    raise exception 'Difficulty was already checked this week';
  end if;
  if p_rank not between 1 and 5 or abs(p_rank - current_rank) > 1 then
    raise exception 'Difficulty moves at most one rank a week';
  end if;

  update public.profiles
     set difficulty_rank = p_rank, difficulty_checked_on = current_date
   where id = uid;
end;
$$;

revoke execute on function public.set_difficulty(integer) from public, anon;
grant execute on function public.set_difficulty(integer) to authenticated;

-- 10. Issuing System quests ----------------------------------------------------------
-- The app builds the quests (lib/game/quests.ts) and sends them here. A slot
-- that already has a quest is skipped. It refuses:
--   - a day other than today (or a main quest not from this week's Monday),
--   - a rank, gain or proof list that does not match the player's rank,
--   - more dailies than the daily time allows, or dailies on the rest day,
--   - more than one strength quest a day.

create function public.issue_quests(p_quests jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  player record;
  q record;
  monday date := date_trunc('week', current_date)::date;
  expected_rank integer;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select difficulty_rank, daily_minutes, onboarded_at into player
    from public.profiles where id = uid;
  if player.onboarded_at is null then
    raise exception 'Finish onboarding first';
  end if;

  for q in
    select * from jsonb_to_recordset(p_quests) as x(
      type text, template_id text, title text, stat text,
      difficulty_rank integer, gain integer, minutes integer,
      counts_for_class boolean, allowed_proofs text[],
      issued_on date, due_on date, slot integer)
  loop
    expected_rank := case q.type
      when 'main' then least(player.difficulty_rank + 1, 5)
      when 'side' then greatest(player.difficulty_rank - 1, 1)
      when 'daily' then player.difficulty_rank
    end;
    if expected_rank is null then
      raise exception 'Unknown quest type';
    end if;
    if q.difficulty_rank is distinct from expected_rank
       or q.gain is distinct from public.quest_gain(q.difficulty_rank, q.type) then
      raise exception 'Quest rank or points do not match';
    end if;
    if q.allowed_proofs is distinct from (
         case when q.difficulty_rank <= 4 then array['evidence', 'honour']
              else array['evidence'] end) then
      raise exception 'Quest proof types do not match its rank';
    end if;

    if q.type = 'main' then
      if q.issued_on is distinct from monday or q.due_on is distinct from monday + 6
         or q.slot is distinct from 1 then
        raise exception 'A main quest runs from this Monday to Sunday';
      end if;
    else
      if q.issued_on is distinct from current_date
         or q.due_on is distinct from current_date then
        raise exception 'Daily and side quests are for today';
      end if;
      if q.type = 'side' and q.slot is distinct from 1 then
        raise exception 'One System side quest a day';
      end if;
      if q.type = 'daily' and coalesce(q.slot not between 1 and public.daily_quest_count(player.daily_minutes), true) then
        raise exception 'Too many daily quests for your daily time';
      end if;
      if q.type = 'daily' and exists (
           select 1 from public.rest_days where user_id = uid and rest_on = current_date) then
        raise exception 'No daily quests on the rest day';
      end if;
    end if;

    insert into public.quests (
      user_id, type, source, template_id, title, stat, difficulty_rank, gain,
      minutes, counts_for_class, allowed_proofs, slot, issued_on, due_on)
    values (
      uid, q.type, 'system', q.template_id, q.title, q.stat, q.difficulty_rank,
      q.gain, q.minutes, coalesce(q.counts_for_class, false), q.allowed_proofs,
      q.slot, q.issued_on, q.due_on)
    on conflict (user_id, issued_on, type, slot) where source = 'system'
    do nothing;
  end loop;

  if (select count(*) from public.quests
       where user_id = uid and source = 'system' and type <> 'main'
         and issued_on = current_date and stat = 'strength') > 1 then
    raise exception 'At most one strength quest a day';
  end if;
end;
$$;

revoke execute on function public.issue_quests(jsonb) from public, anon;
grant execute on function public.issue_quests(jsonb) to authenticated;

-- 11. The user's own side quests -----------------------------------------------------
-- Rank 1 to 3, at most 3 a day, due by Sunday. The app also checks the title
-- against the safety rules (lib/game/safety.ts). Returns the new quest id.

create function public.create_side_quest(
  p_title text,
  p_stat text,
  p_rank integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if char_length(trim(p_title)) not between 3 and 80 then
    raise exception 'Quest titles are 3 to 80 characters';
  end if;
  if p_rank not between 1 and 3 then
    raise exception 'Your own side quests are rank 1 to 3';
  end if;
  if (select count(*) from public.quests
       where user_id = uid and source = 'user'
         and issued_on = current_date) >= 3 then
    raise exception 'You can create 3 side quests a day';
  end if;

  insert into public.quests (
    user_id, type, source, title, stat, difficulty_rank, gain,
    allowed_proofs, issued_on, due_on)
  values (
    uid, 'side', 'user', trim(p_title), p_stat, p_rank,
    public.quest_gain(p_rank, 'side'), array['evidence', 'honour'],
    current_date, date_trunc('week', current_date)::date + 6)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.create_side_quest(text, text, integer) from public, anon;
grant execute on function public.create_side_quest(text, text, integer) to authenticated;

-- 12. Completing a quest -------------------------------------------------------------
-- Saves the proof, marks the quest cleared and awards the points:
-- evidence 80%, honour 50% of the quest's gain, rounded. Auto and crew proof
-- come later. It refuses:
--   - a quest that is not the user's, not open, or past its due day,
--   - honour proof on rank 5 and above, or proof the quest does not list,
--   - evidence without a photo or a 20 to 500 character summary,
--   - a photo outside the user's folder, or one that was never uploaded.
-- Returns the points awarded.

create function public.complete_quest(
  p_quest_id uuid,
  p_proof_type text,
  p_summary text,
  p_photo_path text,
  p_new_points integer -- the stat's points after decay plus the award
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.quests%rowtype;
  awarded integer;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;

  select * into q from public.quests
   where id = p_quest_id and user_id = uid for update;
  if not found then
    raise exception 'Quest not found';
  end if;
  if q.status <> 'open' then
    raise exception 'This quest is no longer open';
  end if;
  if q.due_on < current_date then
    raise exception 'This quest has expired';
  end if;

  if p_proof_type not in ('evidence', 'honour') then
    raise exception 'This proof type is not available yet';
  end if;
  if p_proof_type = 'honour' and q.difficulty_rank >= 5 then
    raise exception 'Honour proof is not allowed for rank 5 and above';
  end if;
  if not (p_proof_type = any (q.allowed_proofs)) then
    raise exception 'This quest does not accept that proof';
  end if;

  if p_proof_type = 'honour' then
    if p_summary is not null or p_photo_path is not null then
      raise exception 'Honour proof has no photo or summary';
    end if;
  else
    if p_summary is null and p_photo_path is null then
      raise exception 'Evidence needs a photo or a summary';
    end if;
    if p_summary is not null and char_length(trim(p_summary)) not between 20 and 500 then
      raise exception 'Summaries are 20 to 500 characters';
    end if;
    if p_photo_path is not null and not exists (
         select 1 from storage.objects
          where bucket_id = 'quest-proofs'
            and name = p_photo_path
            and (storage.foldername(name))[1] = uid::text) then
      raise exception 'Proof photo not found';
    end if;
  end if;

  awarded := round(q.gain * case p_proof_type when 'evidence' then 0.8 else 0.5 end);

  insert into public.quest_proofs (quest_id, user_id, proof_type, photo_path, summary, points_awarded)
  values (q.id, uid, p_proof_type, p_photo_path, nullif(trim(p_summary), ''), awarded);

  update public.quests set status = 'cleared', completed_at = now() where id = q.id;

  perform public.award_stat_points(uid, q.stat, p_new_points, awarded);
  return awarded;
end;
$$;

revoke execute on function public.complete_quest(uuid, text, text, text, integer) from public, anon;
grant execute on function public.complete_quest(uuid, text, text, text, integer) to authenticated;

-- 13. The weekly rest day ------------------------------------------------------------
-- One per week. Today's open dailies become "rested" (no penalty), and the
-- rest itself counts as progress: +5 Endurance.

create function public.take_rest_day(
  p_new_points integer -- Endurance after decay plus the 5 rest day points
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  monday date := date_trunc('week', current_date)::date;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if exists (select 1 from public.rest_days
              where user_id = uid and rest_on between monday and monday + 6) then
    raise exception 'You already took a rest day this week';
  end if;

  insert into public.rest_days (user_id, rest_on) values (uid, current_date);

  update public.quests set status = 'rested'
   where user_id = uid and type = 'daily' and status = 'open'
     and issued_on = current_date;

  perform public.award_stat_points(uid, 'endurance', p_new_points, 5);
end;
$$;

revoke execute on function public.take_rest_day(integer) from public, anon;
grant execute on function public.take_rest_day(integer) to authenticated;

-- 14. Developer tool: pretend a day has passed ----------------------------------------
-- Moves the tester's quest, rest day, activity and difficulty dates back one
-- day, so the next visit is a new quest day. Dev testers only.

create function public.dev_pass_day() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;

  -- Quests move in two steps (far ahead, then back to one day earlier), so
  -- no two quests ever share a slot on the way.
  update public.quests
     set issued_on = issued_on + 100000, due_on = due_on + 100000
   where user_id = uid;
  update public.quests
     set issued_on = issued_on - 100001,
         due_on = due_on - 100001,
         completed_at = completed_at - interval '1 day'
   where user_id = uid;
  update public.rest_days set rest_on = rest_on - 1 where user_id = uid;
  update public.stats set last_active_on = last_active_on - 1 where user_id = uid;
  update public.profiles
     set difficulty_checked_on = difficulty_checked_on - 1,
         sick_since = sick_since - 1
   where id = uid;
end;
$$;

revoke execute on function public.dev_pass_day() from public, anon;
grant execute on function public.dev_pass_day() to authenticated;
