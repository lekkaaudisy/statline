// All tunable game numbers live here: grade thresholds, proof weights,
// decay rate, hand size and drop tables. Never hard-code them elsewhere.
//
// A few of these are repeated as safety checks in the database
// (supabase/migrations). If you change one here, change it there too.
import type { Grade } from "./stats";
import type { CardTier } from "./tiers";

// Cumulative stat points needed for each grade. The next step up, SR (420),
// arrives with the Rare range after the MVP.
export const GRADE_THRESHOLDS: Record<Grade, number> = {
  F: 0,
  E: 20,
  D: 45,
  C: 75,
  B: 110,
  A: 150,
  S: 200,
  SS: 260,
  SSS: 330,
};

// Grades from the onboarding questions are self-reported, so they never go
// above this. Proof during the calibration week can lift them higher.
export const SELF_REPORT_GRADE_CAP: Grade = "B";

// Everyone starts with Potential at C.
export const POTENTIAL_START_GRADE: Grade = "C";

// Each onboarding answer scores 0 to 3 (its position in the list), and each
// stat has two questions, so a stat scores 0 to 6. A score gets the first
// grade in this list whose minimum it reaches. A is still capped to B.
export const ONBOARDING_SCORE_BANDS: readonly {
  minScore: number;
  grade: Grade;
}[] = [
  { minScore: 6, grade: "A" },
  { minScore: 5, grade: "B" },
  { minScore: 3, grade: "C" },
  { minScore: 2, grade: "D" },
  { minScore: 1, grade: "E" },
  { minScore: 0, grade: "F" },
];

// Daily time choices, in minutes.
export const DAILY_MINUTES_OPTIONS = [15, 30, 60] as const;

// Longest goal a user can write, in characters.
export const GOAL_MAX_LENGTH = 120;

// The first grade of the Rare range. The MVP never awards SR, but at SSS the
// status window shows progress toward it.
export const RARE_RANGE_START_POINTS = 420;

// Decay: a stat inactive for this many days starts losing points, this many
// per day, but never falls below the best-ever grade minus these steps.
export const DECAY_START_DAYS = 7;
export const DECAY_POINTS_PER_DAY = 1;
export const DECAY_FLOOR_STEPS = 2;

// Potential is recalculated weekly from the combined weekly points gain of
// the four earned stats, averaged over this many weeks.
export const POTENTIAL_WINDOW_WEEKS = 4;

// Potential moves at most this many grade steps per recalculation.
export const POTENTIAL_MAX_STEPS_PER_WEEK = 1;

// Combined weekly gain -> Potential grade. A gain gets the first grade in
// this list whose minimum it reaches. Retuned in Slice 4 for quest gains: a
// steady 30-minute player earns about 95 points a week, which lands near S.
export const POTENTIAL_BANDS: readonly {
  minWeeklyGain: number;
  grade: Grade;
}[] = [
  { minWeeklyGain: 150, grade: "SSS" },
  { minWeeklyGain: 110, grade: "SS" },
  { minWeeklyGain: 75, grade: "S" },
  { minWeeklyGain: 45, grade: "A" },
  { minWeeklyGain: 25, grade: "B" },
  { minWeeklyGain: 8, grade: "C" },
  { minWeeklyGain: 0, grade: "D" },
  { minWeeklyGain: -10, grade: "E" },
  { minWeeklyGain: -Infinity, grade: "F" },
];

// ---------------------------------------------------------------------------
// Quests (Slice 4)

// Difficulty ranks run 1 to 7, but ranks 6 and 7 are not used in the MVP.
export const MIN_DIFFICULTY_RANK = 1;
export const MAX_DIFFICULTY_RANK = 5;
export const START_DIFFICULTY_RANK = 2;

// Stat points a quest gives at each difficulty rank (index 0 = rank 1).
// Main quests give this many times more.
export const QUEST_GAIN_BY_RANK = [4, 6, 9, 12, 15] as const;
export const MAIN_QUEST_GAIN_MULTIPLIER = 3;

// How long a quest asks for, as a share of the time it has (index 0 = rank
// 1). Rounded to the nearest MINUTES_STEP, never below MIN_QUEST_MINUTES.
export const RANK_EFFORT = [0.5, 0.75, 1, 1.25, 1.5] as const;
export const MINUTES_STEP = 5;
export const MIN_QUEST_MINUTES = 5;

// Daily quests per day for each daily time choice.
export const DAILY_QUESTS_BY_MINUTES: Record<
  (typeof DAILY_MINUTES_OPTIONS)[number],
  number
> = { 15: 1, 30: 2, 60: 3 };

// Optional side quests the System offers each day.
export const SYSTEM_SIDE_QUESTS_PER_DAY = 1;

// About this share of System quests come from the Class; the rest train the
// other stats.
export const CLASS_QUEST_SHARE = 0.6;

// With a second Class, this share of Class quests come from it.
export const SECOND_CLASS_SHARE = 1 / 3;

// Template ids used in the last this-many days are avoided when possible.
export const RECENT_TEMPLATE_DAYS = 2;

// Main quest sessions per week at each rank (index 0 = rank 1).
export const MAIN_QUEST_SESSIONS_BY_RANK = [2, 3, 4, 4, 5] as const;

// Strength safety: one strength daily per day, at most this many minutes
// per strength quest, and at most this many strength days in a main quest.
export const STRENGTH_DAILIES_PER_DAY = 1;
export const STRENGTH_MAX_MINUTES = 30;
export const STRENGTH_MAX_DAYS_PER_WEEK = 5;

// Share of a quest's points each proof type earns.
export const PROOF_WEIGHTS = {
  auto: 1,
  crew: 1,
  evidence: 0.8,
  honour: 0.5,
} as const;

// Honour proof (self check-off) is never allowed above this rank.
export const HONOUR_MAX_RANK = 4;

// A written summary used as evidence must be this long.
export const SUMMARY_MIN_LENGTH = 20;
export const SUMMARY_MAX_LENGTH = 500;

// Proof photos: shrunk on the phone to this longest side before upload, and
// refused above this size.
export const PROOF_PHOTO_MAX_SIDE = 1600;
export const PROOF_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Adaptive difficulty: once a week, look back this many days. Above the top
// of the target success rate, go up a rank; below the bottom, go down. Too
// few quests to judge: stay.
export const TARGET_SUCCESS_MIN = 0.7;
export const TARGET_SUCCESS_MAX = 0.8;
export const DIFFICULTY_WINDOW_DAYS = 14;
export const DIFFICULTY_MIN_SAMPLES = 6;

// The weekly rest day counts as progress: these points on recovery.
export const REST_DAY_POINTS = 5;
export const REST_DAY_STAT = "endurance" as const;

// Side quests the user makes: highest rank, how many a day, title length.
export const USER_SIDE_QUEST_MAX_RANK = 3;
export const USER_SIDE_QUESTS_PER_DAY = 3;
export const USER_QUEST_TITLE_MIN_LENGTH = 3;
export const USER_QUEST_TITLE_MAX_LENGTH = 80;

// Longest quest title (System titles include the goal).
export const QUEST_TITLE_MAX_LENGTH = 200;

// Developer-only test controls (never shown to normal accounts): the point
// buttons, and how far back "Make inactive" moves the last active day.
export const DEV_POINT_STEPS = [5, 20, -20] as const;
export const DEV_INACTIVE_DAYS = 10;

// ---------------------------------------------------------------------------
// Cards (Slice 5)

// The hand holds at most this many cards. Proof cards are kept apart and do
// not count toward it.
export const HAND_SIZE = 10;

// Double XP multiplies the next cleared quest's points (after the proof share).
export const DOUBLE_XP_MULTIPLIER = 2;

// A failed main quest costs one held card. With no card to lose, its stat
// loses this many points instead, never below the decay floor.
export const MAIN_FAIL_STAT_DENT = 5;

// Skill questlines open at the same time, at most.
export const MAX_OPEN_QUESTLINES = 3;

// A Skill questline step stays open this many days (today included). A step
// that runs out is simply given again, with no penalty.
export const SKILL_STEP_DAYS = 3;

// Reward treats the user writes: length in characters.
export const REWARD_TREAT_MIN_LENGTH = 3;
export const REWARD_TREAT_MAX_LENGTH = 60;

// Card drop chances out of 100 at each tier (tier = quest difficulty rank).
// Reward needs a treat set for the tier and Skill needs a questline left to
// open; when one cannot drop, its share goes to the others. Master and
// Challenger (ranks 6 and 7) are not used in the MVP.
const TOP_TIER_DROPS = { reroll: 13, rest: 10, double_xp: 13, shield: 10, reward: 29, skill: 25 };
export const CARD_DROP_WEIGHTS: Record<
  CardTier,
  Record<"reroll" | "rest" | "double_xp" | "shield" | "reward" | "skill", number>
> = {
  Bronze: { reroll: 20, rest: 15, double_xp: 20, shield: 15, reward: 30, skill: 0 },
  Silver: { reroll: 18, rest: 13, double_xp: 17, shield: 12, reward: 28, skill: 12 },
  Gold: { reroll: 15, rest: 12, double_xp: 15, shield: 12, reward: 28, skill: 18 },
  Platinum: { reroll: 14, rest: 11, double_xp: 14, shield: 11, reward: 28, skill: 22 },
  Diamond: TOP_TIER_DROPS,
  Master: TOP_TIER_DROPS,
  Challenger: TOP_TIER_DROPS,
};


// ---------------------------------------------------------------------------
// Calibration (Slice 6)

// The calibration week: days 1 to 7 from the start. The result shows on day 8.
export const CALIBRATION_DAYS = 7;

// Placement quests in the calibration week, for each daily time choice. The
// first four test one stat each; the rest come from the Class goal.
export const PLACEMENT_QUESTS_BY_MINUTES: Record<
  (typeof DAILY_MINUTES_OPTIONS)[number],
  number
> = { 15: 5, 30: 6, 60: 7 };

// A placement quest's difficulty rank tests the grade it is checking. Never
// above 4, so honour proof always stays allowed.
export const PLACEMENT_RANK_BY_GRADE: Record<Grade, number> = {
  F: 1,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 4,
  S: 4,
  SS: 4,
  SSS: 4,
};

// Settling a grade on day 8. Each counted quest scores its proof weight
// (PROOF_WEIGHTS) if cleared, 0 if missed; the proof score is the average.
// Skipped placement quests are not counted. With fewer than the minimum
// counted, there is not enough proof and the grade stays.
export const CALIBRATION_MIN_QUESTS = 2;
export const CALIBRATION_UP_SCORE = 0.7;
export const CALIBRATION_DOWN_SCORE = 0.35;
// A grade moves at most this many steps when it settles.
export const CALIBRATION_MAX_STEPS = 1;

// One season, in days. Recalibration is allowed once per season.
export const SEASON_DAYS = 84;

// The Proof card for finishing calibration.
export const DAY_ONE_TIER: CardTier = "Bronze";

// ---------------------------------------------------------------------------
// Awakening (Slice 6)

// At least this many inactive days in a row, then a window of steady days
// with at least this many active days in it. Rest days count as active.
export const AWAKENING_INACTIVE_DAYS = 7;
export const AWAKENING_STEADY_DAYS = 14;
export const AWAKENING_MIN_ACTIVE_DAYS = 12;

// Points added to each of the four earned stats (never Potential).
export const AWAKENING_STAT_BOOST = 10;

// The Proof card for Awakening.
export const EXCLUSIVE_TIER: CardTier = "Platinum";

// Developer-only fast-forward buttons: idle days (nothing done) and steady
// days (each day marked active before it passes).
export const DEV_IDLE_DAYS = 7;
export const DEV_STEADY_DAYS = 14;
