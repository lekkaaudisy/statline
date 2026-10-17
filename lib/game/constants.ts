// All tunable game numbers live here: grade thresholds, proof weights,
// decay rate, hand size and drop tables. Never hard-code them elsewhere.
//
// A few of these are repeated as safety checks in the database
// (supabase/migrations). If you change one here, change it there too.
import type { Grade } from "./stats";

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
