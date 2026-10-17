# CLAUDE.md — Statline

Statline (working name) is a whole-life quest app. Real-life effort completes quests, quests raise five stats with letter grades, and quests pay out cards. The design is inspired by the quest system in the webtoon Questism, but the app must never use Questism's name, its characters, its art, or text from it.

The owner is not a professional developer. Explain decisions in plain language, keep changes small, and ask before doing anything hard to undo.

## Current scope: MVP (Solo phase + crew-lite)

Build only what is in this list. The Crew map, War cards, mentors, realms and integrations come later. Do not start them unless asked.

1. Sign-up and login
2. Onboarding: Class, goal, daily time, behaviour Q&A, provisional grades
3. Grade engine: points to grades, decay
4. Quests: daily, main, side, skill; completion with proof
5. Cards: drops by tier, a hand of 10, using cards
6. Calibration week and result screen
7. Crew-lite: one crew, weekly leaderboard

## Tech stack

- **Next.js** (App Router) with **TypeScript** in strict mode
- **Tailwind CSS** for styling
- **Supabase**: Auth, Postgres, and Storage (for proof photos). Row Level Security is on for every table.
- **Vercel** for hosting
- An installable **PWA**, phone-first. Every screen must work at 390 px wide.
- **Vitest** for unit tests

Do not add a new library without saying why and asking first.

## Project rules

- **Game logic lives in `lib/game/`** as pure functions, with no database or UI code. Examples: grade calculation, decay, card drops, and quest difficulty. Every function in it has unit tests.
- **All tunable numbers live in `lib/game/constants.ts`**: grade thresholds, proof weights, decay rate, hand size, and drop tables. Never hard-code them anywhere else.
- **Database changes are Supabase migrations**, never manual edits. Each table gets RLS policies, so a user can only read and write their own rows. Crew-lite is the only exception: crewmates can see each other's grade summaries.
- **Secrets go only in environment variables** (`.env.local`, plus Vercel's settings). Never commit them or print them.
- **Plan first:** before writing code for a new slice, list the files you will create or change and wait for approval.
- After each slice, give simple steps for testing it on a phone.

## Domain rules (do not change without asking)

### The five stats

| Stat | Real-life meaning |
| --- | --- |
| Strength | Physical capability |
| Speed | Execution: planned tasks done on time |
| Endurance | Consistency and recovery |
| Intelligence | Learning and skill |
| Potential | Momentum: how fast the other four are rising |

- **Potential is never earned directly.** It is recalculated weekly from the trend of the other four stats. It starts at C for everyone. Never describe it as talent.
- **Virtues are not stats.** Kindness, patience and the like are never scored.

### Grade ladder

The MVP shows the Human range: F, E, D, C, B, A, S, SS, SSS. Minus and plus steps, and the Rare range (SR, SSR, UR, LR, MR) and above, come later.

Starting point thresholds (cumulative stat points):

| Grade | F | E | D | C | B | A | S | SS | SSS | SR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Points | 0 | 20 | 45 | 75 | 110 | 150 | 200 | 260 | 330 | 420 |

- Each step needs more points than the last.
- **Decay:** a stat inactive for 7 or more days loses points slowly, but never drops below the user's best-ever grade minus two steps.

### Classes

Fighter, Scholar, Builder, Professional, Monk, Leader. Each user picks one main Class (and optionally a second), one concrete goal, and 15, 30 or 60 minutes a day.

- Quests are about 60% for the Class goal and 40% for the other stats. Daily quests target the weakest stat.
- The Class can change once per season, and stats are always kept.
- Do not call the Class a "Path". "Your Own Path" is a late-game reward and is out of MVP scope.

### Onboarding and calibration

1. Ask 8 to 10 behaviour questions, two per stat, about recent facts ("How many days last week…"), not self-image.
2. Show provisional grades with a question mark ("C?"). **Self-reported grades are capped at B.**
3. Run a calibration week of 5 to 7 placement quests, built from the Class, the goal and the answers.
4. Each grade then settles on proof, up or down. The screen says "Calibrated", never "Declined". The user earns a "Day One" Proof card.
5. Skipped placement quests carry no penalty.

### Quests

| Type | Notes |
| --- | --- |
| Main | Weekly, from the Class goal. A failed main quest costs one held card or a small stat dent, never everything. |
| Daily | 1 to 3 per day, small |
| Side | Optional, from the System or made by the user |
| Skill | A questline opened by a Skill card |

- Difficulty rank runs from 1 to 7. Ranks 6 and 7 are not used in the MVP.
- Quest difficulty adapts to keep the user's success rate near 70 to 80%.

**Proof weights:**

| Proof | Points |
| --- | --- |
| Auto (data) | 100% |
| Crew confirmation | 100% |
| Evidence (photo, summary) | 80% |
| Honour (self check-off) | 50% |

Honour proof is never allowed for difficulty rank 5 or higher.

### Cards

- **Card tier = quest difficulty rank:** Bronze 1, Silver 2, Gold 3, Platinum 4, Diamond 5, Master 6, Challenger 7.
- **MVP card families:**
  - **System:** Reroll, Rest, Double XP, Shield
  - **Reward:** a treat the user sets in advance
  - **Skill:** opens a questline
  - **Proof:** Day One, Exclusive; never tradable
- **The hand holds at most 10 cards.** Proof cards sit apart and never count toward the 10.
- **No card, stat or grade can ever be bought with money.** Paid features are cosmetic only.

### Growth (MVP)

The only growth stage in the MVP is **Awakening**: at least 7 inactive days, then 14 days of steady quests. It gives a stat boost and one Exclusive card. Ascension, the wall, the realms and Your Own Path come later.

## Safety rules (always)

- Never create quests with calorie targets, weight-loss goals, fasting or body-size goals. Fitness quests are about activity and skill only.
- Every week includes at least one rest day that counts as progress.
- A "Sick or injured" status pauses penalties and decay.
- Strength quests scale up gradually and cap daily volume.
- Stats are private by default. Crewmates only see a grade summary.
- Users can export and delete all their data.

## Look and feel

- Dark "system window" interface. Display font: Chakra Petch. Body font: IBM Plex Sans.
- Background `#0A0E15`, panels `#111826`, accent cyan `#5ED1F0`, gold `#E8B94A`.
- Card tier colours: Bronze `#C98B5A`, Silver `#BFC8D2`, Gold `#E8B94A`, Platinum `#74D9CF`.
- Touch targets are at least 44 px. Text contrast is at least 4.5:1. No emoji in the interface.
- The clickable prototype (the Statline Prototype artifact) is the reference for the status window, quest list, card reveal and hand.

## Language

All interface text is in English.