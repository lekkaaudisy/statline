// The calibration week: placement quests built from the onboarding answers,
// the Class and the goal, then settling each provisional grade on proof.
//
// Settling (day 8), for each earned stat:
// - Counted quests: that stat's quests cleared in days 1 to 7, and its daily,
//   side and main quests missed in days 1 to 7. Skipped placement quests,
//   rested, excused and shielded quests are not counted.
// - Each cleared quest scores its proof weight (1, 0.8 or 0.5); a missed
//   quest scores 0. The proof score is the average.
// - Fewer than 2 counted quests: not enough proof, the grade stays.
//   0.7 or more: up one step. Below 0.35: down one step. Otherwise it stays.
import type { ClassId } from "./classes";
import {
  CALIBRATION_DAYS,
  CALIBRATION_DOWN_SCORE,
  CALIBRATION_MAX_STEPS,
  CALIBRATION_MIN_QUESTS,
  CALIBRATION_UP_SCORE,
  DAILY_QUESTS_BY_MINUTES,
  PLACEMENT_QUESTS_BY_MINUTES,
  PLACEMENT_RANK_BY_GRADE,
  PROOF_WEIGHTS,
  SEASON_DAYS,
} from "./constants";
import { addDays, daysBetween } from "./dates";
import { effortMinutes, questGain } from "./difficulty";
import { gradeToPoints, pointsToGrade, stepToward } from "./grades";
import { QUESTIONS, type Answers } from "./onboarding";
import { GOAL_PLACEMENTS, QUESTION_PLACEMENTS } from "./placement-templates";
import { allowedProofs, type ProofType, type SelectableProof } from "./proof";
import { fillTitle, usesMinutes, type QuestTemplate } from "./quest-templates";
import type { DailyMinutes } from "./quests";
import { EARNED_STATS, GRADES, type EarnedStat, type Grade } from "./stats";

// --- The calibration week ------------------------------------------------------

// Day 1 is the start day. Day 8 and later means the week is over.
export function calibrationDay(startedOn: string, today: string): number {
  return daysBetween(startedOn, today) + 1;
}

// The last day placement quests can be cleared (day 7).
export function calibrationLastDay(startedOn: string): string {
  return addDays(startedOn, CALIBRATION_DAYS - 1);
}

export type CalibrationPhase = "week" | "due" | "settled";

export function calibrationPhase(
  calibration: { startedOn: string; settledOn: string | null },
  today: string,
): CalibrationPhase {
  if (calibration.settledOn) return "settled";
  return calibrationDay(calibration.startedOn, today) > CALIBRATION_DAYS ? "due" : "week";
}

// --- Placement quests ----------------------------------------------------------

export type PlacementDraft = {
  type: "placement";
  templateId: string;
  title: string;
  stat: EarnedStat;
  rank: number;
  gain: number;
  minutes: number | null;
  countsForClass: boolean;
  allowedProofs: SelectableProof[];
  // The calibration day it is given on (1 to 7). Also its slot.
  day: number;
  slot: number;
};

export function placementCount(dailyMinutes: DailyMinutes): number {
  return PLACEMENT_QUESTS_BY_MINUTES[dailyMinutes];
}

// The stat's question with the lower answer (the first on a tie): the habit
// the placement quest tests.
export function weakerQuestion(stat: EarnedStat, answers: Answers): string {
  const [first, second] = QUESTIONS.filter((q) => q.stat === stat);
  return (answers[second.id] ?? 0) < (answers[first.id] ?? 0) ? second.id : first.id;
}

// Builds the whole set of placement quests, in the order they are given:
// the first goal quest, two stat quests, the second goal quest (30 and 60
// minutes), the other two stat quests, then the third goal quest (60
// minutes). Stat quests start with the lowest grade. The same inputs always
// give the same quests.
export function generatePlacementQuests(input: {
  answers: Answers;
  mainClass: ClassId;
  goal: string;
  dailyMinutes: DailyMinutes;
  grades: Record<EarnedStat, Grade>;
}): PlacementDraft[] {
  const { answers, mainClass, goal, dailyMinutes, grades } = input;
  const count = placementCount(dailyMinutes);
  const goalCount = count - EARNED_STATS.length;
  const goalQuests = GOAL_PLACEMENTS[mainClass].slice(0, goalCount);
  const byGrade = [...EARNED_STATS].sort(
    (a, b) => GRADES.indexOf(grades[a]) - GRADES.indexOf(grades[b]),
  );
  const statQuests = byGrade.map((stat) => QUESTION_PLACEMENTS[weakerQuestion(stat, answers)]);

  const ordered: { template: QuestTemplate; countsForClass: boolean }[] = [];
  const addGoal = (i: number) => {
    if (goalQuests[i]) ordered.push({ template: goalQuests[i], countsForClass: true });
  };
  const addStats = (from: number, to: number) => {
    for (const template of statQuests.slice(from, to)) {
      ordered.push({ template, countsForClass: false });
    }
  };
  addGoal(0);
  addStats(0, 2);
  addGoal(1);
  addStats(2, 4);
  addGoal(2);

  // A placement quest takes the place of one daily quest, so it gets a
  // daily quest's share of the daily time.
  const available = dailyMinutes / DAILY_QUESTS_BY_MINUTES[dailyMinutes];
  return ordered.map(({ template, countsForClass }, i) => {
    const rank = PLACEMENT_RANK_BY_GRADE[grades[template.stat]];
    const minutes = usesMinutes(template)
      ? effortMinutes(available, rank, template.stat, dailyMinutes)
      : null;
    return {
      type: "placement",
      templateId: template.id,
      title: fillTitle(template.title, { minutes: minutes ?? undefined, goal }),
      stat: template.stat,
      rank,
      gain: questGain(rank, "placement"),
      minutes,
      countsForClass,
      allowedProofs: allowedProofs(rank),
      day: i + 1,
      slot: i + 1,
    };
  });
}

// The placement quests to give today: every one whose day has come and that
// has not been given yet (so a missed visit catches up). None after day 7.
export function placementsDue(
  placements: readonly PlacementDraft[],
  startedOn: string,
  today: string,
  issuedSlots: ReadonlySet<number>,
): PlacementDraft[] {
  const day = calibrationDay(startedOn, today);
  if (day < 1 || day > CALIBRATION_DAYS) return [];
  return placements.filter((p) => p.day <= day && !issuedSlots.has(p.slot));
}

// The placement quest planned for today, which takes one daily quest's place.
export function placementForToday(
  placements: readonly PlacementDraft[],
  startedOn: string,
  today: string,
): PlacementDraft | null {
  const day = calibrationDay(startedOn, today);
  return placements.find((p) => p.day === day) ?? null;
}

// --- Settling grades -------------------------------------------------------------

export type CalibrationQuest = {
  type: string;
  stat: EarnedStat;
  status: string;
  dueOn: string;
  // The day it was cleared, if it was.
  completedOn: string | null;
  // The proof it was cleared with, if it was.
  proof: ProofType | null;
};

export type Evidence = {
  // The average proof score, or null with too few quests to judge.
  score: number | null;
  counted: number;
};

function inWeek(date: string, startedOn: string): boolean {
  return date >= startedOn && date <= calibrationLastDay(startedOn);
}

// One quest's part in the proof score: its proof weight if cleared in the
// week, 0 if missed in the week, or null if it is not counted.
export function questScore(quest: CalibrationQuest, startedOn: string): number | null {
  if (quest.status === "cleared") {
    if (!quest.completedOn || !inWeek(quest.completedOn, startedOn)) return null;
    return quest.proof ? PROOF_WEIGHTS[quest.proof] : null;
  }
  // Skipping a placement quest carries no penalty.
  if (quest.status === "missed" && quest.type !== "placement" && inWeek(quest.dueOn, startedOn)) {
    return 0;
  }
  return null;
}

export function statEvidence(
  quests: readonly CalibrationQuest[],
  stat: EarnedStat,
  startedOn: string,
): Evidence {
  const scores = quests
    .filter((q) => q.stat === stat)
    .map((q) => questScore(q, startedOn))
    .filter((s): s is number => s !== null);
  if (scores.length < CALIBRATION_MIN_QUESTS) return { score: null, counted: scores.length };
  const total = scores.reduce((sum, s) => sum + s, 0);
  return { score: Math.round((total / scores.length) * 100) / 100, counted: scores.length };
}

// The grade after calibration: at most one step up or down from `grade`.
export function settleGrade(grade: Grade, evidence: Evidence): Grade {
  const { score } = evidence;
  if (score === null) return grade;
  const index = GRADES.indexOf(grade);
  if (score >= CALIBRATION_UP_SCORE) {
    return stepToward(grade, GRADES[GRADES.length - 1], CALIBRATION_MAX_STEPS);
  }
  if (score < CALIBRATION_DOWN_SCORE && index > 0) {
    return stepToward(grade, GRADES[0], CALIBRATION_MAX_STEPS);
  }
  return grade;
}

// Points after calibration, moved only as far as the new grade needs: up to
// the bottom of a higher grade, down to the top of a lower one, or kept.
export function settledPoints(points: number, settled: Grade): number {
  const before = pointsToGrade(points);
  const from = GRADES.indexOf(before);
  const to = GRADES.indexOf(settled);
  if (to > from) return gradeToPoints(settled);
  if (to < from) return gradeToPoints(before) - 1;
  return points;
}

export type StatSettlement = {
  before: Grade;
  after: Grade;
  points: number;
  score: number | null;
  counted: number;
};

// Settles all four earned stats from their points (no decay applies while
// provisional) and the quests from the calibration week.
export function settleCalibration(input: {
  points: Record<EarnedStat, number>;
  quests: readonly CalibrationQuest[];
  startedOn: string;
}): Record<EarnedStat, StatSettlement> {
  const result = {} as Record<EarnedStat, StatSettlement>;
  for (const stat of EARNED_STATS) {
    const before = pointsToGrade(input.points[stat]);
    const evidence = statEvidence(input.quests, stat, input.startedOn);
    const after = settleGrade(before, evidence);
    result[stat] = {
      before,
      after,
      points: settledPoints(input.points[stat], after),
      ...evidence,
    };
  }
  return result;
}

// --- Recalibration -------------------------------------------------------------

// The day recalibration opens again: one season after the last calibration
// started.
export function recalibrationOpensOn(lastStartedOn: string): string {
  return addDays(lastStartedOn, SEASON_DAYS);
}

// Once per season, and never while a calibration is still running.
export function canRecalibrate(
  last: { startedOn: string; settledOn: string | null } | null,
  today: string,
): boolean {
  if (!last) return false;
  if (!last.settledOn) return false;
  return today >= recalibrationOpensOn(last.startedOn);
}

// Used by the screens to read saved settlement results safely.
export function isStatSettlement(value: unknown): value is StatSettlement {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    GRADES.includes(v.before as Grade) &&
    GRADES.includes(v.after as Grade) &&
    typeof v.points === "number" &&
    (v.score === null || typeof v.score === "number") &&
    typeof v.counted === "number"
  );
}
