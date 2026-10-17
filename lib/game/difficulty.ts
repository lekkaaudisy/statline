// Quest difficulty: points and effort per rank, and the weekly adjustment
// that keeps the user's success rate near 70 to 80%.
import {
  DIFFICULTY_MIN_SAMPLES,
  MAIN_QUEST_GAIN_MULTIPLIER,
  MAX_DIFFICULTY_RANK,
  MIN_DIFFICULTY_RANK,
  MIN_QUEST_MINUTES,
  MINUTES_STEP,
  QUEST_GAIN_BY_RANK,
  RANK_EFFORT,
  STRENGTH_MAX_MINUTES,
  TARGET_SUCCESS_MAX,
  TARGET_SUCCESS_MIN,
} from "./constants";
import { weekStart } from "./dates";
import type { EarnedStat } from "./stats";

export type QuestType = "daily" | "main" | "side" | "skill";

export function clampRank(rank: number): number {
  return Math.min(MAX_DIFFICULTY_RANK, Math.max(MIN_DIFFICULTY_RANK, rank));
}

export function isValidRank(rank: unknown): rank is number {
  return (
    typeof rank === "number" &&
    Number.isInteger(rank) &&
    rank >= MIN_DIFFICULTY_RANK &&
    rank <= MAX_DIFFICULTY_RANK
  );
}

// Main quests are one rank harder than dailies, System side quests one easier.
export function rankFor(type: QuestType, playerRank: number): number {
  if (type === "main") return clampRank(playerRank + 1);
  if (type === "side") return clampRank(playerRank - 1);
  return clampRank(playerRank);
}

// Stat points a quest gives before the proof share.
export function questGain(rank: number, type: QuestType): number {
  const base = QUEST_GAIN_BY_RANK[clampRank(rank) - 1];
  return type === "main" ? base * MAIN_QUEST_GAIN_MULTIPLIER : base;
}

// Minutes a quest asks for: the time it has, scaled by rank, rounded to 5,
// never more than the user's whole daily time, and capped for strength.
export function effortMinutes(
  available: number,
  rank: number,
  stat: EarnedStat,
  dailyMinutes: number,
): number {
  const raw = available * RANK_EFFORT[clampRank(rank) - 1];
  let minutes = Math.round(raw / MINUTES_STEP) * MINUTES_STEP;
  minutes = Math.min(minutes, dailyMinutes);
  if (stat === "strength") minutes = Math.min(minutes, STRENGTH_MAX_MINUTES);
  return Math.max(MIN_QUEST_MINUTES, minutes);
}

export type QuestOutcome = "cleared" | "missed";

// Share of quests cleared, or null when there are too few to judge.
export function successRate(outcomes: readonly QuestOutcome[]): number | null {
  if (outcomes.length < DIFFICULTY_MIN_SAMPLES) return null;
  return outcomes.filter((o) => o === "cleared").length / outcomes.length;
}

// The rank for the coming week: one step up when the user clears more than
// the target, one step down when they clear less, otherwise the same.
export function nextDifficulty(
  current: number,
  outcomes: readonly QuestOutcome[],
): number {
  const rate = successRate(outcomes);
  if (rate === null) return clampRank(current);
  if (rate > TARGET_SUCCESS_MAX) return clampRank(current + 1);
  if (rate < TARGET_SUCCESS_MIN) return clampRank(current - 1);
  return clampRank(current);
}

// The difficulty is checked once a week, on the first visit of the week.
export function difficultyCheckDue(
  checkedOn: string | null,
  today: string,
): boolean {
  return checkedOn === null || checkedOn < weekStart(today);
}
