-- Slice 7: Crew-lite. Adds crews and crew_members, crew proof confirmation
-- (a top-up to 100% after a quest is cleared), card gifting between
-- crewmates, and the counts behind the weekly contribution leaderboard.
--
-- Privacy: crewmates get no direct access to each other's stats, profiles,
-- quests or proofs. Row Level Security works on whole rows, so a policy on
-- stats would also show raw points. Instead, the read functions below check
-- that the caller is in the same crew and return only summary fields:
-- display name, Class, and letter grades (empty while still provisional).
--
-- Users cannot write the new tables directly. Everything goes through the
-- functions below, which check the rules again.
--
-- Some numbers here repeat lib/game/constants.ts as a safety net (30
-- members, crew names 3 to 30 characters, 6-character invite codes, the
-- 3-day confirmation window, proof weights). Keep them in step.

-- 1. Crews -----------------------------------------------------------------------

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 30),
  -- No 0, O, 1 or I, so codes are easy to read out.
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

-- One row per member. The owner is a role here (not a column on crews), so
-- when the owner leaves or deletes their account the next-oldest member
-- takes over.
create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  -- unique: one crew per user.
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create unique index crew_members_one_owner
  on public.crew_members (crew_id) where role = 'owner';

-- The caller's crew, or empty. Security definer so the crew_members policy
-- can use it without checking itself in a loop.
create function public.my_crew_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select crew_id from public.crew_members where user_id = auth.uid();
$$;

revoke execute on function public.my_crew_id() from public, anon;
grant execute on function public.my_crew_id() to authenticated;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

-- Non-members cannot read a crew at all, so invite codes cannot be browsed.
create policy "Members can read their own crew"
  on public.crews for select to authenticated
  using (id = (select public.my_crew_id()));

create policy "Members can read their crew's member list"
  on public.crew_members for select to authenticated
  using (crew_id = (select public.my_crew_id()));

revoke insert, update, delete on public.crews from anon, authenticated;
revoke insert, update, delete on public.crew_members from anon, authenticated;
revoke all on public.crews, public.crew_members from anon;

-- 2. Crew proof and card gifting columns ----------------------------------------------

-- crew_requested_at: the owner asked their crew to confirm this proof.
-- confirmed_at (with the existing confirmed_by): a crewmate confirmed it.
alter table public.quest_proofs
  add column crew_requested_at timestamptz,
  add column confirmed_at timestamptz,
  -- confirmed_at marks a confirmed proof. confirmed_by can later become
  -- empty if the crewmate deletes their account.
  add constraint quest_proofs_confirmed_together
    check (confirmed_by is null or confirmed_at is not null),
  add constraint quest_proofs_not_self_confirmed
    check (confirmed_by is null or confirmed_by <> user_id);

-- A gifted card keeps who gave it, so it cannot be passed on again.
alter table public.cards
  add column gifted_by uuid references public.profiles (id) on delete set null,
  add column gifted_at timestamptz;

create index cards_gifted_by on public.cards (gifted_by, gifted_at) where gifted_at is not null;
create index quest_proofs_confirmed_by on public.quest_proofs (confirmed_by, confirmed_at)
  where confirmed_at is not null;

-- 3. Helpers (internal) ---------------------------------------------------------------

-- A fresh, unused invite code.
create function public.make_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * 32)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.crews where invite_code = code);
  end loop;
  return code;
end;
$$;

revoke execute on function public.make_invite_code() from public, anon, authenticated;

-- The letter grade for a stat, or empty while it is provisional (crewmates
-- never see provisional grades).
create function public.summary_grade(p_points integer, p_provisional boolean) returns text
language sql immutable set search_path = '' as $$
  select case when p_provisional then null
              else (array['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'])
                   [public.grade_step(p_points) + 1] end;
$$;

revoke execute on function public.summary_grade(integer, boolean) from public, anon, authenticated;

-- 4. When a member leaves (or deletes their account) ---------------------------------
-- An empty crew is deleted. A crew without an owner passes to the member who
-- joined first. The leaver's open confirmation requests are withdrawn.

create function public.handle_member_left() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.quest_proofs
     set crew_requested_at = null
   where user_id = old.user_id and confirmed_at is null and crew_requested_at is not null;

  if not exists (select 1 from public.crews where id = old.crew_id) then
    return old; -- the crew itself is being deleted
  end if;
  if not exists (select 1 from public.crew_members where crew_id = old.crew_id) then
    delete from public.crews where id = old.crew_id;
  elsif not exists (select 1 from public.crew_members
                     where crew_id = old.crew_id and role = 'owner') then
    update public.crew_members set role = 'owner'
     where crew_id = old.crew_id
       and user_id = (select user_id from public.crew_members
                       where crew_id = old.crew_id
                       order by joined_at, user_id limit 1);
  end if;
  return old;
end;
$$;

revoke execute on function public.handle_member_left() from public, anon, authenticated;

create trigger crew_members_after_delete
  after delete on public.crew_members
  for each row execute function public.handle_member_left();

-- 5. Create, join, leave ------------------------------------------------------------

-- Creates a crew with the caller as owner. Returns the crew id.
create function public.create_crew(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  clean text := trim(p_name);
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarded_at is not null) then
    raise exception 'Finish onboarding first';
  end if;
  if exists (select 1 from public.crew_members where user_id = uid) then
    raise exception 'You are already in a crew';
  end if;
  if clean is null or char_length(clean) not between 3 and 30 then
    raise exception 'Crew names are 3 to 30 characters';
  end if;

  insert into public.crews (name, invite_code)
  values (clean, public.make_invite_code())
  returning id into new_id;
  insert into public.crew_members (crew_id, user_id, role) values (new_id, uid, 'owner');
  return new_id;
end;
$$;

revoke execute on function public.create_crew(text) from public, anon;
grant execute on function public.create_crew(text) to authenticated;

-- Joins the crew with this invite code (spaces and dashes ignored, any
-- case). Returns the crew id.
create function public.join_crew(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  target uuid;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarded_at is not null) then
    raise exception 'Finish onboarding first';
  end if;
  if exists (select 1 from public.crew_members where user_id = uid) then
    raise exception 'You are already in a crew';
  end if;

  -- Locked, so two people joining at once cannot pass the member limit.
  select id into target from public.crews where invite_code = code for update;
  if not found then
    raise exception 'No crew has that invite code';
  end if;
  if (select count(*) from public.crew_members where crew_id = target) >= 30 then
    raise exception 'This crew is full (30 members)';
  end if;

  insert into public.crew_members (crew_id, user_id, role) values (target, uid, 'member');
  return target;
end;
$$;

revoke execute on function public.join_crew(text) from public, anon;
grant execute on function public.join_crew(text) to authenticated;

create function public.leave_crew() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  delete from public.crew_members where user_id = uid;
  if not found then
    raise exception 'You are not in a crew';
  end if;
end;
$$;

revoke execute on function public.leave_crew() from public, anon;
grant execute on function public.leave_crew() to authenticated;

-- The owner can replace the invite code (the old one stops working).
create function public.new_invite_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  crew uuid;
  code text;
begin
  select crew_id into crew from public.crew_members where user_id = uid and role = 'owner';
  if not found then
    raise exception 'Only the crew owner can make a new invite code';
  end if;
  code := public.make_invite_code();
  update public.crews set invite_code = code where id = crew;
  return code;
end;
$$;

revoke execute on function public.new_invite_code() from public, anon;
grant execute on function public.new_invite_code() to authenticated;

-- 6. Grade summaries ------------------------------------------------------------------
-- Everyone in the caller's crew (including the caller): name, Class, role
-- and five letter grades. No points, best grades, goals or sick status.

create function public.crew_member_summaries()
returns table (
  user_id uuid,
  display_name text,
  main_class text,
  role text,
  joined_at timestamptz,
  strength text,
  speed text,
  endurance text,
  intelligence text,
  potential text
)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name, p.main_class, m.role, m.joined_at,
         max(public.summary_grade(s.points, s.provisional)) filter (where s.stat = 'strength'),
         max(public.summary_grade(s.points, s.provisional)) filter (where s.stat = 'speed'),
         max(public.summary_grade(s.points, s.provisional)) filter (where s.stat = 'endurance'),
         max(public.summary_grade(s.points, s.provisional)) filter (where s.stat = 'intelligence'),
         max(public.summary_grade(s.points, s.provisional)) filter (where s.stat = 'potential')
    from public.crew_members m
    join public.profiles p on p.id = m.user_id
    left join public.stats s on s.user_id = m.user_id
   where m.crew_id = public.my_crew_id()
   group by m.user_id, p.display_name, p.main_class, m.role, m.joined_at
   order by m.joined_at, m.user_id;
$$;

revoke execute on function public.crew_member_summaries() from public, anon;
grant execute on function public.crew_member_summaries() to authenticated;

-- 7. Crew proof confirmation -------------------------------------------------------------
-- The owner clears a quest as usual (evidence or honour), then asks the crew.
-- Within 3 days of clearing, any other crewmate can confirm. The proof
-- becomes Crew proof (100%) and the owner gets the difference.

create function public.request_crew_confirmation(p_quest_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pr public.quest_proofs%rowtype;
  cleared_at timestamptz;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if public.my_crew_id() is null then
    raise exception 'Join a crew first';
  end if;

  select * into pr from public.quest_proofs
   where quest_id = p_quest_id and user_id = uid for update;
  if not found then
    raise exception 'Quest not found';
  end if;
  if pr.proof_type not in ('evidence', 'honour') then
    raise exception 'This quest already has full proof';
  end if;
  if pr.crew_requested_at is not null then
    raise exception 'Your crew has already been asked';
  end if;
  select completed_at into cleared_at from public.quests where id = p_quest_id;
  if cleared_at is null or cleared_at::date < current_date - 3 then
    raise exception 'Crew confirmation is open for 3 days after clearing';
  end if;

  update public.quest_proofs set crew_requested_at = now() where quest_id = p_quest_id;
end;
$$;

revoke execute on function public.request_crew_confirmation(uuid) from public, anon;
grant execute on function public.request_crew_confirmation(uuid) to authenticated;

-- Crewmates' quests waiting for confirmation (not the caller's own). The
-- written summary is shown; photos stay private.
create function public.crew_confirmation_requests()
returns table (
  quest_id uuid,
  user_id uuid,
  display_name text,
  title text,
  stat text,
  difficulty_rank smallint,
  gain smallint,
  proof_type text,
  points_awarded smallint,
  summary text,
  completed_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select q.id, q.user_id, p.display_name, q.title, q.stat, q.difficulty_rank, q.gain,
         pr.proof_type, pr.points_awarded, pr.summary, q.completed_at
    from public.quest_proofs pr
    join public.quests q on q.id = pr.quest_id
    join public.profiles p on p.id = pr.user_id
    join public.crew_members m on m.user_id = pr.user_id
   where m.crew_id = public.my_crew_id()
     and pr.user_id <> auth.uid()
     and pr.crew_requested_at is not null
     and pr.confirmed_at is null
     and q.completed_at::date >= current_date - 3
   order by q.completed_at;
$$;

revoke execute on function public.crew_confirmation_requests() from public, anon;
grant execute on function public.crew_confirmation_requests() to authenticated;

-- Confirms a crewmate's quest. Returns the extra points they got. The top-up
-- is the difference between Crew (100%) and the original proof's share,
-- doubled if Double XP doubled the original award. The stat is not marked
-- active today: the crewmate did the quest, not the confirmation.
create function public.confirm_crew_proof(p_quest_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  grades constant text[] := array['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  uid uuid := auth.uid();
  my_crew uuid := public.my_crew_id();
  pr public.quest_proofs%rowtype;
  q public.quests%rowtype;
  base integer;
  top_up integer;
  st public.stats%rowtype;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if my_crew is null then
    raise exception 'Join a crew first';
  end if;

  select * into pr from public.quest_proofs where quest_id = p_quest_id for update;
  if not found
     or pr.crew_requested_at is null
     or not exists (select 1 from public.crew_members
                     where user_id = pr.user_id and crew_id = my_crew) then
    raise exception 'Confirmation request not found';
  end if;
  if pr.user_id = uid then
    raise exception 'You cannot confirm your own quest';
  end if;
  if pr.confirmed_at is not null then
    raise exception 'This quest is already confirmed';
  end if;

  select * into q from public.quests where id = p_quest_id;
  if q.completed_at is null or q.completed_at::date < current_date - 3 then
    raise exception 'Crew confirmation is open for 3 days after clearing';
  end if;

  base := round(q.gain * case pr.proof_type when 'evidence' then 0.8 else 0.5 end);
  top_up := q.gain - base;
  if pr.points_awarded >= 2 * base and base > 0 then
    top_up := top_up * 2; -- Double XP doubled the original award
  end if;

  update public.quest_proofs
     set proof_type = 'crew',
         confirmed_by = uid,
         confirmed_at = now(),
         points_awarded = points_awarded + top_up
   where quest_id = p_quest_id;

  select * into st from public.stats
   where user_id = pr.user_id and stat = q.stat for update;
  update public.stats
     set points = st.points + top_up,
         best_grade = case
           when st.provisional then st.best_grade
           else grades[greatest(coalesce(array_position(grades, st.best_grade), 1),
                                public.grade_step(st.points + top_up) + 1)]
         end
   where user_id = pr.user_id and stat = q.stat;

  return top_up;
end;
$$;

revoke execute on function public.confirm_crew_proof(uuid) from public, anon;
grant execute on function public.confirm_crew_proof(uuid) to authenticated;

-- 8. Card gifting --------------------------------------------------------------------------
-- Only System cards (Reroll, Rest, Double XP, Shield) that are held and were
-- not gifted before. Reward cards are the giver's own treat, Skill cards are
-- tied to their questlines, and Proof cards are never traded. A full hand
-- gets the card as pending (swap or discard), like a normal drop.

create function public.gift_card(p_card_id uuid, p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  my_crew uuid := public.my_crew_id();
  c public.cards%rowtype;
  new_status text;
begin
  if uid is null then
    raise exception 'Not logged in';
  end if;
  if my_crew is null then
    raise exception 'Join a crew first';
  end if;
  if p_to = uid or not exists (select 1 from public.crew_members
                                where user_id = p_to and crew_id = my_crew) then
    raise exception 'Choose a crewmate';
  end if;

  select * into c from public.cards where id = p_card_id and user_id = uid for update;
  if not found or c.status <> 'held' then
    raise exception 'That card is not in your hand';
  end if;
  if c.kind not in ('reroll', 'rest', 'double_xp', 'shield') then
    raise exception 'Only System cards can be gifted';
  end if;
  if c.gifted_by is not null then
    raise exception 'A gifted card cannot be passed on';
  end if;

  new_status := case when public.hand_count(p_to) < 10 then 'held' else 'pending' end;
  update public.cards
     set user_id = p_to, status = new_status, gifted_by = uid, gifted_at = now()
   where id = p_card_id;
  return new_status;
end;
$$;

revoke execute on function public.gift_card(uuid, uuid) from public, anon;
grant execute on function public.gift_card(uuid, uuid) to authenticated;

-- 9. Weekly contribution counts --------------------------------------------------------------
-- For each member of the caller's crew, in the week starting on this
-- Monday: quests cleared, crewmates' proofs confirmed, cards gifted. The
-- score (with its weights and caps) is worked out in lib/game/crew.ts. No
-- stats or grades are involved.

create function public.crew_week_counts(p_week_start date)
returns table (
  user_id uuid,
  quests_cleared integer,
  proofs_confirmed integer,
  cards_gifted integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'Weeks start on Monday';
  end if;
  return query
  select m.user_id,
         (select count(*)::integer from public.quests q
           where q.user_id = m.user_id and q.status = 'cleared'
             and q.completed_at >= p_week_start and q.completed_at < p_week_start + 7),
         (select count(*)::integer from public.quest_proofs pr
           where pr.confirmed_by = m.user_id
             and pr.confirmed_at >= p_week_start and pr.confirmed_at < p_week_start + 7),
         (select count(*)::integer from public.cards c
           where c.gifted_by = m.user_id
             and c.gifted_at >= p_week_start and c.gifted_at < p_week_start + 7)
    from public.crew_members m
   where m.crew_id = public.my_crew_id()
   order by m.joined_at, m.user_id;
end;
$$;

revoke execute on function public.crew_week_counts(date) from public, anon;
grant execute on function public.crew_week_counts(date) to authenticated;
