# Statline MVP build plan

Seven slices, each small enough to build and test in one Claude Code session. Build them in order: each slice depends on the ones before it. CLAUDE.md holds the rules. This file holds the order and the prompts.

## How to use this plan

1. Open a new Claude Code session for each slice.
2. Paste that slice's prompt.
3. Read the plan Claude Code shows you. Correct it before approving.
4. When the build is finished, test the slice on your phone using its "Done when" list.
5. When everything in the list works, commit, then tick the slice off below.

**Progress:**

- [x] Slice 0: Setup
- [ ] Slice 1: Login and profile
- [ ] Slice 2: Onboarding
- [ ] Slice 3: Grade engine and status window
- [ ] Slice 4: Quests
- [ ] Slice 5: Cards
- [ ] Slice 6: Calibration week
- [ ] Slice 7: Crew-lite

## Before slice 0: your own setup

Do these steps yourself. No coding is needed.

1. Create free accounts at **GitHub**, **Supabase** and **Vercel**. Sign up for Vercel with your GitHub account.
2. On GitHub, create an empty private repository called `statline`.
3. In Supabase, create a new project. Save the database password somewhere safe, such as a password manager. **Never paste it into chat.**
4. Open Claude Code on that repository, from claude.ai/code or the Code tab in the desktop app.
5. Add `CLAUDE.md` to the root folder, and this file as `docs/BUILD_PLAN.md`.

## Data model (starting sketch)

Claude Code may refine this sketch in a slice plan, but it should explain any change.

| Table | Holds |
| --- | --- |
| `profiles` | Display name, Class, second Class, goal, daily minutes, Awakening status, sick-or-injured flag |
| `stats` | One row per user per stat: points, best grade, provisional flag, last active date |
| `onboarding_answers` | The behaviour Q&A answers |
| `quests` | Type, title, stat, difficulty rank, gain, allowed proof types, due date, status |
| `quest_proofs` | Proof type, photo or summary, confirmed-by, points awarded |
| `cards` | Owner, name, family, tier, effect, used or held, source quest |
| `reward_settings` | The user's self-set treats per card tier |
| `crews` | Name, invite code, owner |
| `crew_members` | Crew, user, role |
| `stat_history` | Weekly snapshots, used for Potential and the leaderboard |

## Slice 0: Setup

**Goal:** an empty app, live on the internet, with nothing in it yet.

**Done when:**

- The app opens at a Vercel web address and shows a dark placeholder screen saying "Statline".
- It can be added to the phone's home screen and opens like an app.
- `npm test` runs one passing sample test.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 0: Setup.
Set up a Next.js (App Router, TypeScript strict) project with Tailwind, Vitest and PWA support (manifest + icons placeholder), using the colours and fonts in CLAUDE.md. Create the folders lib/game/ (with an empty constants.ts) and supabase/migrations/. Add one sample Vitest test. Do not connect Supabase yet.
First show me your plan: the files you will create and the commands you will run. Wait for my approval. After building, explain in simple steps how I deploy it to Vercel and check it on my phone.
```

## Slice 1: Login and profile

**Goal:** users can create an account, log in and log out.

**Done when:**

- You can sign up with an email address, log in, log out, and log back in.
- A logged-out user who opens any app page is sent to the login screen.
- A second test account cannot see the first account's data.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 1: Login and profile.
Connect Supabase Auth with email login (magic link or email + password, recommend one and say why). Create the profiles table as a migration with RLS so users only see their own row. Protect every app page except login. Tell me exactly which environment variables I must add in .env.local and in Vercel, and where to find their values in Supabase — never ask me to paste secrets into chat.
First show me your plan and the migration. Wait for my approval. Afterwards, give me phone test steps including the two-account privacy check.
```

## Slice 2: Onboarding

**Goal:** a new user goes from "the System awakens" to a provisional status window.

**Done when:**

- A brand-new account sees the intro, then chooses a Class (with an optional second), one goal and daily minutes.
- The user answers 8 to 10 behaviour questions, two per stat.
- The status window shows dimmed grades with a question mark ("C?"), none higher than B, and Potential at C.
- An account that has finished onboarding never sees it again.
- Unit tests cover the mapping from answers to grades, including the B cap.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 2: Onboarding.
Build the flow from CLAUDE.md "Onboarding and calibration" steps 1–2: intro screen, Class choice (main + optional second), one goal (offer 4–5 example goals per Class plus a custom field), daily time (15/30/60), then 8–10 behaviour questions (two per stat, about recent facts). Put the answer-to-grade mapping in lib/game/ as a pure, tested function, with the B cap. Save everything to profiles, onboarding_answers and stats (provisional = true). Show the provisional status window with "?" grades.
Propose the questions and the scoring before coding. Wait for my approval.
```

## Slice 3: Grade engine and status window

**Goal:** points become grades correctly, and the status window shows them.

**Done when:**

- The status window shows each stat's grade, a progress bar, and "X pts to next grade", matching the look of the prototype.
- Unit tests cover:
  - every grade threshold,
  - decay starting after 7 inactive days,
  - decay never dropping below the best grade minus two steps,
  - the sick-or-injured flag pausing decay,
  - Potential being calculated from the weekly trend.
- A hidden test page or developer button can add points, so you can watch grades change.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 3: Grade engine and status window.
In lib/game/ write pure functions: pointsToGrade, progressToNext, applyDecay (7-day start, floor = best grade minus two steps, paused when sick/injured) and calculatePotential (from stat_history weekly trend, starts at C). All numbers go in constants.ts. Write thorough Vitest tests first, then the functions. Then build the status window screen matching the Statline prototype (status window, grade, bar, points to next grade, Potential shown as momentum). Add a developer-only control to add test points.
Show your plan and the list of test cases first. Wait for my approval.
```

## Slice 4: Quests

**Goal:** the System gives quests, users complete them with proof, and the points land on the right stat.

**Done when:**

- Each day shows 1 to 3 daily quests aimed at the weakest stat, plus a weekly main quest built from the goal, plus optional side quests.
- The quest mix follows about 60% Class goal and 40% other stats.
- Completing a quest with each proof type awards the right share of points (100, 100, 80 or 50%).
- Honour proof is refused for difficulty rank 5 and above.
- Photo proof uploads and stays private.
- The user can create their own side quest.
- A weekly rest day counts as progress.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 4: Quests.
Create quests and quest_proofs tables (migrations + RLS) and a private Supabase Storage bucket for proof photos. In lib/game/ write tested functions for: generating daily/main/side quests from Class, goal, daily minutes and weakest stat (60/40 rule), proof weights, the honour-proof limit, and adaptive difficulty targeting a 70–80% success rate. Use a hand-written quest template library (no AI generation yet) with at least 10 templates per Class, all following the safety rules. Build the quest list and completion screens matching the prototype. Include the weekly rest day.
Show the plan, the template list and the tables first. Wait for my approval.
```

## Slice 5: Cards

**Goal:** quests pay out cards, and cards do something.

**Done when:**

- Completing a quest shows the "Quest cleared" reveal, with the stat gain, any rank-up, and a card whose tier matches the difficulty.
- The hand never holds more than 10 cards. When it is full, the user chooses to swap a card or discard the new one.
- Each card works when used:
  - **Reroll** swaps a quest.
  - **Rest** skips a day with no penalty.
  - **Double XP** doubles the next quest.
  - **Shield** protects against one missed day.
  - **Reward** cards redeem the user's self-set treat.
  - **Skill** cards open a short questline.
- Proof cards cannot be used, traded or discarded.
- A failed main quest costs one held card or a small stat dent, never more.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 5: Cards.
Create cards and reward_settings tables (migrations + RLS). In lib/game/ write tested functions for: card drop by difficulty tier, the 10-card hand limit, each MVP card effect (Reroll, Rest, Double XP, Shield, Reward, Skill) and the failed-main-quest penalty. Write at least 2 starter Skill questlines per Class (4–12 quests each, following the safety rules). Build the card reveal and hand screens matching the prototype, plus a settings screen where users set their Reward treats per tier. No card may ever be purchasable.
Show the plan and the card list first. Wait for my approval.
```

## Slice 6: Calibration week

**Goal:** provisional grades settle on real proof after the first week.

**Done when:**

- A new user's first 7 days include 5 to 7 placement quests built from their answers.
- On day 8 the calibration result screen shows each grade settling up or down, the question marks disappear, and the user receives the "Day One" Proof card.
- The screen says "Calibrated", never "Declined".
- Skipping placement quests carries no penalty.
- Recalibration is limited to once per season.
- Awakening triggers correctly: at least 7 inactive days, then 14 days of steady quests, giving a stat boost and one Exclusive card.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 6: Calibration week (plus Awakening).
In lib/game/ write tested functions for: generating 5–7 placement quests from onboarding_answers, Class and goal; settling each provisional grade from proof gathered in the first 7 days; and detecting Awakening (7+ inactive days, then 14 days of steady quests). Build the calibration result screen (wording: "Calibrated", never "Declined"), the Day One Proof card, and the Awakening moment with its Exclusive card. Add a developer control to fast-forward days for testing.
Show the plan and the settlement rules first. Wait for my approval.
```

## Slice 7: Crew-lite

**Goal:** friends form a crew and compete on a weekly leaderboard.

**Done when:**

- A user can create a crew and share its invite code. Others join with the code, up to 30 members.
- The weekly leaderboard ranks members by contribution: quests done, proofs confirmed and cards gifted. It does not rank by raw stats.
- Crewmates see each other's grade summaries only, never full stats.
- Provisional grades are hidden from the crew.
- A crewmate can confirm another member's quest as crew proof.
- A member can leave the crew.

**Prompt:**

```text
Read CLAUDE.md and docs/BUILD_PLAN.md. We are building Slice 7: Crew-lite.
Create crews and crew_members tables (migrations + RLS that lets crewmates read only each other's grade summaries). Build: create crew, invite code, join, leave, member list with grade summaries, crew proof confirmation, and a weekly contribution leaderboard (quests done, proofs confirmed, cards gifted — not raw stats, provisional grades excluded). Write tests for the contribution score and the RLS rules.
Show the plan and the RLS policies first. Wait for my approval.
```

## After every slice

- Test every item in the "Done when" list on your phone.
- Ask Claude Code to run `npm test`. All tests must pass.
- Commit with a clear message, such as "Slice 3: grade engine and status window".
- If you changed a rule along the way, update CLAUDE.md in the same commit.

## When something breaks

Paste this into Claude Code, filled in:

```text
Bug in Slice [number].
What I did: [steps]
What I expected: [result]
What happened instead: [result]
Error message or screenshot: [paste]
Find the cause first and explain it simply, then propose a fix. Don't change unrelated code.
```

## After the MVP

When the pilot shows that people come back 4 or more days a week, move on to V1 in the concept doc: the territory map, War cards, seasons and Ascension.
