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
