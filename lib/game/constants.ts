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
// this list whose minimum it reaches. First guesses: retune once quests give
// real points (Slice 4).
export const POTENTIAL_BANDS: readonly {
  minWeeklyGain: number;
  grade: Grade;
}[] = [
  { minWeeklyGain: 100, grade: "SSS" },
  { minWeeklyGain: 75, grade: "SS" },
  { minWeeklyGain: 50, grade: "S" },
  { minWeeklyGain: 30, grade: "A" },
  { minWeeklyGain: 15, grade: "B" },
  { minWeeklyGain: 5, grade: "C" },
  { minWeeklyGain: 0, grade: "D" },
  { minWeeklyGain: -10, grade: "E" },
  { minWeeklyGain: -Infinity, grade: "F" },
];

// Developer-only test controls (never shown to normal accounts): the point
// buttons, and how far back "Make inactive" moves the last active day.
export const DEV_POINT_STEPS = [5, 20, -20] as const;
export const DEV_INACTIVE_DAYS = 10;
