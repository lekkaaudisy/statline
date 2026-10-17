-- Slice 5: cards. Adds cards and reward_settings, a few quest columns for
-- rerolls, shields, penalties and Skill questlines, and the functions that
-- drop, hold and use cards.
--
-- No card can ever be bought: cards only come from quests, calibration,
-- Awakening or the developer tools, and there is no price anywhere.
--
-- Users can read their own cards but cannot write them directly. Everything
-- goes through the functions below, which check the rules again.
--
-- Some numbers here repeat lib/game/constants.ts as a safety net (hand size
-- 10, Double XP x2, the 5-point dent, 3 open questlines, 3 days per Skill
-- step, treat length). Keep them in step.

-- 1. Helpers -------------------------------------------------------------------

-- Card tier = quest difficulty rank.
create function public.tier_for_rank(p_rank integer) returns text
language sql immutable set search_path = '' as $$
  select (array['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Challenger'])
         [least(greatest(p_rank, 1), 7)];
$$;

revoke execute on function public.tier_for_rank(integer) from public, anon, authenticated;

-- 2. Cards -----------------------------------------------------------------------

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'reroll', 'rest', 'double_xp', 'shield', 'reward', 'skill', 'day_one', 'exclusive')),
  tier text not null check (tier in (
    'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Challenger')),
  -- pending: dropped into a full hand, waiting for swap or discard.
  -- held: in the hand. active: in play (Double XP, Shield, open questline).
  -- used: spent. discarded: thrown away. lost: taken by a failed main quest.
  status text not null check (status in ('pending', 'held', 'active', 'used', 'discarded', 'lost')),
  -- Where it came from. There is deliberately no 'purchase'.
  source text not null check (source in ('quest', 'calibration', 'awakening', 'dev')),
  -- The quest that dropped it. One card per quest.
  source_quest_id uuid unique references public.quests (id) on delete set null,
  -- Reward cards: the treat, as set when the card dropped.
  treat text check (char_length(treat) between 1 and 60),
  -- Skill cards: the questline, its length once opened, and steps cleared.
  questline_id text check (char_length(questline_id) between 1 and 30),
  questline_length smallint check (questline_length between 4 and 12),
  questline_step smallint not null default 0 check (questline_step >= 0),
  -- The day an active card went into play.
  activated_on date,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  -- Proof cards are never used, traded or discarded.
  constraint cards_proof_kept
    check (kind not in ('day_one', 'exclusive') or status = 'held'),
  constraint cards_reward_has_treat check ((kind = 'reward') = (treat is not null)),
  constraint cards_skill_has_questline check ((kind = 'skill') = (questline_id is not null)),
  constraint cards_active_kinds
    check (status <> 'active' or (kind in ('double_xp', 'shield', 'skill') and activated_on is not null)),
  constraint cards_open_questline_length
    check (kind <> 'skill' or status not in ('active', 'used') or questline_length is not null)
);

create index cards_user_status on public.cards (user_id, status);

-- One Double XP and one Shield in play at a time.
create unique index cards_one_active
  on public.cards (user_id, kind)
  where status = 'active' and kind in ('double_xp', 'shield');

-- Each questline is on at most one card (unless that card was thrown away).
create unique index cards_one_per_questline
  on public.cards (user_id, questline_id)
  where questline_id is not null and status not in ('discarded', 'lost');

alter table public.cards enable row level security;

create policy "Users can read their own cards"
  on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.cards from anon, authenticated;

-- Cards in the hand: held, and not Proof cards (they sit apart).
create function public.hand_count(p_user_id uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.cards
   where user_id = p_user_id and status = 'held'
     and kind not in ('day_one', 'exclusive');
$$;

revoke execute on function public.hand_count(uuid) from public, anon, authenticated;

-- 3. Reward treats -----------------------------------------------------------------
-- One treat per tier, written by the user. The app also checks treats
-- against the safety rules (lib/game/safety.ts).

create table public.reward_settings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null check (tier in (
    'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Challenger')),
  treat text not null check (char_length(treat) between 3 and 60),
  updated_at timestamptz not null default now(),
  primary key (user_id, tier)
);

alter table public.reward_settings enable row level security;

create policy "Users can read their own treats"
  on public.reward_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own treats"
  on public.reward_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can change their own treats"
  on public.reward_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own treats"
  on public.reward_settings for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.reward_settings from anon;
grant select, insert, update, delete on public.reward_settings to authenticated;

create trigger reward_settings_set_updated_at
  before update on public.reward_settings
  for each row execute function public.set_updated_at();

-- 4. Quest changes -------------------------------------------------------------------
-- rerolled: swapped by a Reroll card. shielded: missed on a day a Shield
-- covered, so it carries no penalty.

alter table public.quests drop constraint quests_status_check;
alter table public.quests add constraint quests_status_check
  check (status in ('open', 'cleared', 'missed', 'rested', 'excused', 'rerolled', 'shielded'));

alter table public.quests
  -- Skill quests: the Skill card whose questline gave this step.
  add column card_id uuid references public.cards (id) on delete set null,
  -- Failed main quests: what the penalty took (a card, a stat dent, or
  -- nothing). Empty until the penalty is applied, so it is applied once.
  add column penalty text check (penalty in ('card', 'dent', 'none'));

-- Main quests missed before cards existed carry no penalty.
update public.quests set penalty = 'none' where type = 'main' and status = 'missed';

-- A rerolled quest gives up its slot to its replacement.
drop index public.quests_one_per_slot;
create unique index quests_one_per_slot
  on public.quests (user_id, issued_on, type, slot)
  where source = 'system' and status <> 'rerolled';

-- 5. Rest days from Rest cards ---------------------------------------------------------
-- weekly: the one free rest day a week (+5 Endurance). card: a Rest card.

alter table public.rest_days
  add column kind text not null default 'weekly' check (kind in ('weekly', 'card'));

create or replace function public.take_rest_day(
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
              where user_id = uid and kind = 'weekly'
                and rest_on between monday and monday + 6) then
    raise exception 'You already took a rest day this week';
  end if;
  if exists (select 1 from public.rest_days where user_id = uid and rest_on = current_date) then
    raise exception 'Today is already a rest day';
  end if;

  insert into public.rest_days (user_id, rest_on, kind) values (uid, current_date, 'weekly');

  update public.quests set status = 'rested'
   where user_id = uid and type = 'daily' and status = 'open'
     and issued_on = current_date;

  perform public.award_stat_points(uid, 'endurance', p_new_points, 5);
end;
$$;

-- 6. Issuing System quests (now with Skill steps) ----------------------------------------
-- Same checks as before for daily, side and main quests. A Skill step must
-- be the next step of an open questline on the user's own Skill card, rank 1
-- to 4, open for 3 days. A questline with a step still open, or given today,
-- is skipped. The one-strength-quest-a-day cap now counts Skill steps too.

create or replace function public.issue_quests(p_quests jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  player record;
  q record;
  c public.cards%rowtype;
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
      issued_on date, due_on date, slot integer, card_id uuid)
  loop
    if q.allowed_proofs is distinct from (
         case when q.difficulty_rank <= 4 then array['evidence', 'honour']
              else array['evidence'] end) then
      raise exception 'Quest proof types do not match its rank';
    end if;

    if q.type = 'skill' then
      select * into c from public.cards
       where id = q.card_id and user_id = uid and kind = 'skill' and status = 'active';
      if not found then
        raise exception 'Open the questline first';
      end if;
      if q.template_id is distinct from 'skill-' || c.questline_id || '-' || (c.questline_step + 1) then
        raise exception 'That is not the next step of the questline';
      end if;
      if q.difficulty_rank not between 1 and 4
         or q.gain is distinct from public.quest_gain(q.difficulty_rank, 'skill') then
        raise exception 'Quest rank or points do not match';
      end if;
      if q.issued_on is distinct from current_date
         or q.due_on is distinct from current_date + 2
         or coalesce(q.slot not between 1 and 3, true) then
        raise exception 'Skill steps start today and stay open for 3 days';
      end if;
      if exists (select 1 from public.quests
                  where user_id = uid and card_id = c.id
                    and ((status = 'open' and due_on >= current_date)
                         or issued_on = current_date)) then
        continue;
      end if;

      insert into public.quests (
        user_id, type, source, template_id, title, stat, difficulty_rank, gain,
        minutes, counts_for_class, allowed_proofs, slot, issued_on, due_on, card_id)
      values (
        uid, 'skill', 'system', q.template_id, q.title, q.stat, q.difficulty_rank,
        q.gain, null, true, q.allowed_proofs, q.slot, q.issued_on, q.due_on, c.id)
      on conflict (user_id, issued_on, type, slot)
        where source = 'system' and status <> 'rerolled'
      do nothing;
      continue;
    end if;

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
    on conflict (user_id, issued_on, type, slot)
      where source = 'system' and status <> 'rerolled'
    do nothing;
  end loop;

  if (select count(*) from public.quests
       where user_id = uid and source = 'system' and type in ('daily', 'side', 'skill')
         and status <> 'rerolled'
         and issued_on = current_date and stat = 'strength') > 1 then
    raise exception 'At most one strength quest a day';
  end if;
end;
$$;

-- 7. Completing a quest (now with Double XP and a card drop) --------------------------------
-- Same checks as before. Then:
--   - an active Double XP card doubles the points and is used up,
--   - a Skill step moves its questline on (the card is used up after the
--     last step),
--   - one card drops, its tier matching the quest's rank. The app rolls
--     which kind (lib/game/card-drops.ts); this checks the kind can drop:
--     never a Proof card, a Reward only with a treat set for the tier (the
--     treat is copied from the settings here), a Skill card never from a
--     Skill quest and only for a questline not already on a card.
--   - The card goes into the hand, or waits if the hand holds 10 already.
-- Returns {"awarded": points, "card_id": id, "card_status": held|pending}.

drop function public.complete_quest(uuid, text, text, text, integer);

create function public.complete_quest(
  p_quest_id uuid,
  p_proof_type text,
  p_summary text,
  p_photo_path text,
  p_new_points integer, -- the stat's points after decay plus the award
  p_card_kind text,
  p_questline_id text   -- Skill cards only
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.quests%rowtype;
  awarded integer;
  double_card uuid;
  card_tier text;
  card_treat text;
  new_status text;
  new_card uuid;
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

  -- The card first, so a refused card saves nothing.
  card_tier := public.tier_for_rank(q.difficulty_rank);
  if p_card_kind not in ('reroll', 'rest', 'double_xp', 'shield', 'reward', 'skill') then
    raise exception 'That card cannot drop from a quest';
  end if;
  if p_card_kind = 'reward' then
    select treat into card_treat from public.reward_settings
     where user_id = uid and tier = card_tier;
    if card_treat is null then
      raise exception 'Set a treat for this tier first';
    end if;
  end if;
  if p_card_kind = 'skill' then
    if q.type = 'skill' or card_tier = 'Bronze' then
      raise exception 'A Skill card cannot drop from this quest';
    end if;
    if p_questline_id is null or exists (
         select 1 from public.cards
          where user_id = uid and questline_id = p_questline_id
            and status not in ('discarded', 'lost')) then
      raise exception 'That questline is already on a card';
    end if;
  elsif p_questline_id is not null then
    raise exception 'Only Skill cards open questlines';
  end if;

  awarded := round(q.gain * case p_proof_type when 'evidence' then 0.8 else 0.5 end);

  select id into double_card from public.cards
   where user_id = uid and kind = 'double_xp' and status = 'active'
     for update;
  if double_card is not null then
    awarded := awarded * 2;
    update public.cards set status = 'used', used_at = now() where id = double_card;
  end if;

  insert into public.quest_proofs (quest_id, user_id, proof_type, photo_path, summary, points_awarded)
  values (q.id, uid, p_proof_type, p_photo_path, nullif(trim(p_summary), ''), awarded);

  update public.quests set status = 'cleared', completed_at = now() where id = q.id;

  perform public.award_stat_points(uid, q.stat, p_new_points, awarded);

  if q.type = 'skill' and q.card_id is not null then
    update public.cards
       set questline_step = questline_step + 1,
           status = case when questline_step + 1 >= questline_length then 'used' else status end,
           used_at = case when questline_step + 1 >= questline_length then now() else used_at end
     where id = q.card_id and user_id = uid and status = 'active';
  end if;

  new_status := case when public.hand_count(uid) < 10 then 'held' else 'pending' end;
  insert into public.cards (user_id, kind, tier, status, source, source_quest_id, treat, questline_id)
  values (uid, p_card_kind, card_tier, new_status, 'quest', q.id, card_treat,
          case when p_card_kind = 'skill' then p_questline_id end)
  returning id into new_card;

  return jsonb_build_object('awarded', awarded, 'card_id', new_card, 'card_status', new_status);
end;
$$;

revoke execute on function public.complete_quest(uuid, text, text, text, integer, text, text) from public, anon;
grant execute on function public.complete_quest(uuid, text, text, text, integer, text, text) to authenticated;

-- 8. A card waiting for a full hand ------------------------------------------------------
-- Keep it (swapping out a held card, never a Proof card, if the hand is
-- still full) or discard it.

create function public.resolve_pending_card(
  p_card_id uuid,
  p_keep boolean,
  p_swap_out uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  perform 1 from public.cards
   where id = p_card_id and user_id = uid and status = 'pending' for update;
  if not found then
    raise exception 'That card is no longer waiting';
  end if;

  if not p_keep then
    update public.cards set status = 'discarded' where id = p_card_id;
    return;
  end if;

  if p_swap_out is not null then
    update public.cards set status = 'discarded'
     where id = p_swap_out and user_id = uid and status = 'held'
       and kind not in ('day_one', 'exclusive');
    if not found then
      raise exception 'Choose a card from your hand to swap out';
    end if;
  end if;
  if public.hand_count(uid) >= 10 then
    raise exception 'Your hand is full. Choose a card to swap out';
  end if;
  update public.cards set status = 'held' where id = p_card_id;
end;
$$;

revoke execute on function public.resolve_pending_card(uuid, boolean, uuid) from public, anon;
grant execute on function public.resolve_pending_card(uuid, boolean, uuid) to authenticated;

-- Throws away a held card. Never a Proof card.
create function public.discard_card(p_card_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  update public.cards set status = 'discarded'
   where id = p_card_id and user_id = uid and status in ('held', 'pending')
     and kind not in ('day_one', 'exclusive');
  if not found then
    raise exception 'That card cannot be discarded';
  end if;
end;
$$;

revoke execute on function public.discard_card(uuid) from public, anon;
grant execute on function public.discard_card(uuid) to authenticated;

-- 9. Using cards ---------------------------------------------------------------------------

-- Locks one of the user's held cards of the given kind, or refuses.
create function public.take_held_card(p_user_id uuid, p_card_id uuid, p_kind text)
returns public.cards
language plpgsql set search_path = '' as $$
declare
  c public.cards%rowtype;
begin
  select * into c from public.cards
   where id = p_card_id and user_id = p_user_id and status = 'held' and kind = p_kind
     for update;
  if not found then
    raise exception 'That card is not in your hand';
  end if;
  return c;
end;
$$;

revoke execute on function public.take_held_card(uuid, uuid, text) from public, anon, authenticated;

-- Reroll: swaps one of today's open daily or System side quests. The app
-- builds the replacement (lib/game/card-effects.ts); it must keep the type,
-- slot, rank, points, proof and day, use a different template, and keep the
-- one-strength-quest-a-day cap.
create function public.use_reroll(
  p_card_id uuid,
  p_quest_id uuid,
  p_new jsonb -- {"template_id", "title", "stat", "minutes", "counts_for_class"}
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  old public.quests%rowtype;
  new_template text := p_new ->> 'template_id';
  new_stat text := p_new ->> 'stat';
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  perform public.take_held_card(uid, p_card_id, 'reroll');

  select * into old from public.quests
   where id = p_quest_id and user_id = uid for update;
  if not found or old.status <> 'open' or old.source <> 'system'
     or old.type not in ('daily', 'side') or old.issued_on <> current_date then
    raise exception 'Only today''s open daily and side quests can be rerolled';
  end if;
  if new_template is null or new_template = old.template_id
     or exists (select 1 from public.quests
                 where user_id = uid and issued_on = current_date
                   and template_id = new_template) then
    raise exception 'The new quest must be a different one';
  end if;
  if new_stat = 'strength' and exists (
       select 1 from public.quests
        where user_id = uid and source = 'system' and type in ('daily', 'side', 'skill')
          and issued_on = current_date and status <> 'rerolled'
          and stat = 'strength' and id <> old.id) then
    raise exception 'At most one strength quest a day';
  end if;

  update public.quests set status = 'rerolled' where id = old.id;

  insert into public.quests (
    user_id, type, source, template_id, title, stat, difficulty_rank, gain,
    minutes, counts_for_class, allowed_proofs, slot, issued_on, due_on)
  values (
    uid, old.type, 'system', new_template, p_new ->> 'title', new_stat,
    old.difficulty_rank, old.gain, (p_new ->> 'minutes')::integer,
    old.counts_for_class, old.allowed_proofs, old.slot, old.issued_on, old.due_on);

  update public.cards set status = 'used', used_at = now() where id = p_card_id;
end;
$$;

revoke execute on function public.use_reroll(uuid, uuid, jsonb) from public, anon;
grant execute on function public.use_reroll(uuid, uuid, jsonb) to authenticated;

-- Rest: today's open daily quests are rested, with no penalty. Not on a day
-- that is already a rest day. This is not the weekly rest day: no points.
create function public.use_rest(p_card_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  perform public.take_held_card(uid, p_card_id, 'rest');

  if exists (select 1 from public.rest_days where user_id = uid and rest_on = current_date) then
    raise exception 'Today is already a rest day';
  end if;
  if not exists (select 1 from public.quests
                  where user_id = uid and type = 'daily' and status = 'open'
                    and issued_on = current_date) then
    raise exception 'No open daily quests to rest today';
  end if;

  insert into public.rest_days (user_id, rest_on, kind) values (uid, current_date, 'card');
  update public.quests set status = 'rested'
   where user_id = uid and type = 'daily' and status = 'open'
     and issued_on = current_date;
  update public.cards set status = 'used', used_at = now() where id = p_card_id;
end;
$$;

revoke execute on function public.use_rest(uuid) from public, anon;
grant execute on function public.use_rest(uuid) to authenticated;

-- Double XP and Shield go into play. One of each at a time.
create function public.activate_card(p_card_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  card_kind text;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select kind into card_kind from public.cards
   where id = p_card_id and user_id = uid and status = 'held'
     and kind in ('double_xp', 'shield')
     for update;
  if not found then
    raise exception 'That card is not in your hand';
  end if;
  if exists (select 1 from public.cards
              where user_id = uid and kind = card_kind and status = 'active') then
    raise exception 'One is already active';
  end if;
  update public.cards set status = 'active', activated_on = current_date where id = p_card_id;
end;
$$;

revoke execute on function public.activate_card(uuid) from public, anon;
grant execute on function public.activate_card(uuid) to authenticated;

-- Reward: redeems the treat.
create function public.redeem_reward(p_card_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  perform public.take_held_card(uid, p_card_id, 'reward');
  update public.cards set status = 'used', used_at = now() where id = p_card_id;
end;
$$;

revoke execute on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- Skill: opens the questline. Its steps come through issue_quests().
-- At most 3 questlines open at once.
create function public.open_questline(p_card_id uuid, p_length integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  perform public.take_held_card(uid, p_card_id, 'skill');
  if (select count(*) from public.cards
       where user_id = uid and kind = 'skill' and status = 'active') >= 3 then
    raise exception 'You can have 3 questlines open at once. Finish one first';
  end if;
  if p_length not between 4 and 12 then
    raise exception 'Questlines have 4 to 12 steps';
  end if;
  update public.cards
     set status = 'active', activated_on = current_date, questline_length = p_length
   where id = p_card_id;
end;
$$;

revoke execute on function public.open_questline(uuid, integer) from public, anon;
grant execute on function public.open_questline(uuid, integer) to authenticated;

-- 10. Shield ------------------------------------------------------------------------------
-- Covers one missed day, from the day it was raised. The app picks the day
-- (lib/game/card-effects.ts: the first day with a missed daily or main
-- quest). Every missed daily and main quest due that day becomes shielded.

create function public.apply_shield(p_card_id uuid, p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  raised date;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select activated_on into raised from public.cards
   where id = p_card_id and user_id = uid and kind = 'shield' and status = 'active'
     for update;
  if not found then
    raise exception 'No shield is up';
  end if;
  if p_day < raised or p_day >= current_date then
    raise exception 'The shield does not cover that day';
  end if;

  update public.quests set status = 'shielded'
   where user_id = uid and due_on = p_day and status = 'missed'
     and type in ('daily', 'main') and penalty is null;
  if not found then
    raise exception 'Nothing was missed that day';
  end if;
  update public.cards set status = 'used', used_at = now() where id = p_card_id;
end;
$$;

revoke execute on function public.apply_shield(uuid, date) from public, anon;
grant execute on function public.apply_shield(uuid, date) to authenticated;

-- 11. Failed main quest penalty ----------------------------------------------------------
-- One held card (never a Proof card), or, only with no card to lose, a dent
-- of at most 5 points to the quest's stat. Applied once per quest. The app
-- picks the card (lowest tier, then oldest) and the dent
-- (lib/game/main-penalty.ts).

create function public.apply_main_penalty(
  p_quest_id uuid,
  p_card_id uuid,
  p_new_points integer -- the stat's saved points after the dent (no card)
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.quests%rowtype;
  current_points integer;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  select * into q from public.quests
   where id = p_quest_id and user_id = uid for update;
  if not found or q.type <> 'main' or q.status <> 'missed' or q.penalty is not null then
    raise exception 'No penalty is owed for this quest';
  end if;

  if p_card_id is not null then
    update public.cards set status = 'lost'
     where id = p_card_id and user_id = uid and status = 'held'
       and kind not in ('day_one', 'exclusive');
    if not found then
      raise exception 'That card is not in your hand';
    end if;
    update public.quests set penalty = 'card' where id = q.id;
    return;
  end if;

  if public.hand_count(uid) > 0 then
    raise exception 'A held card is lost before any stat';
  end if;
  select points into current_points from public.stats
   where user_id = uid and stat = q.stat for update;
  if p_new_points > current_points or p_new_points < greatest(current_points - 5, 0) then
    raise exception 'A failed main quest costs at most 5 points';
  end if;
  update public.stats set points = p_new_points where user_id = uid and stat = q.stat;
  update public.quests set penalty = 'dent' where id = q.id;
end;
$$;

revoke execute on function public.apply_main_penalty(uuid, uuid, integer) from public, anon;
grant execute on function public.apply_main_penalty(uuid, uuid, integer) to authenticated;

-- 12. Developer tools ------------------------------------------------------------------------

-- Pretend a day has passed: as before, plus the days cards went into play.
create or replace function public.dev_pass_day() returns void
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
  update public.cards set activated_on = activated_on - 1 where user_id = uid;
  update public.profiles
     set difficulty_checked_on = difficulty_checked_on - 1,
         sick_since = sick_since - 1
   where id = uid;
end;
$$;

-- Gives one of each usable card (Silver), for testing every effect. A
-- Reward card needs a Silver treat set; a Skill card needs a questline not
-- already on a card (the app sends one, or none). Cards that do not fit in
-- the hand wait, as usual.
create function public.dev_give_cards(p_questline_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  k text;
  silver_treat text;
begin
  if uid is null
     or not exists (select 1 from public.dev_testers where user_id = uid) then
    raise exception 'Developer tools are not enabled for this account';
  end if;
  select treat into silver_treat from public.reward_settings
   where user_id = uid and tier = 'Silver';

  foreach k in array array['reroll', 'rest', 'double_xp', 'shield', 'reward', 'skill'] loop
    continue when k = 'reward' and silver_treat is null;
    continue when k = 'skill' and p_questline_id is null;
    insert into public.cards (user_id, kind, tier, status, source, treat, questline_id)
    values (uid, k, 'Silver',
            case when public.hand_count(uid) < 10 then 'held' else 'pending' end,
            'dev',
            case when k = 'reward' then silver_treat end,
            case when k = 'skill' then p_questline_id end);
  end loop;
end;
$$;

revoke execute on function public.dev_give_cards(text) from public, anon;
grant execute on function public.dev_give_cards(text) to authenticated;
