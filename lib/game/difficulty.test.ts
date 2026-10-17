import { describe, expect, it } from "vitest";
import {
  clampRank,
  difficultyCheckDue,
  effortMinutes,
  isValidRank,
  nextDifficulty,
  questGain,
  rankFor,
  successRate,
  type QuestOutcome,
} from "./difficulty";
import { MAX_DIFFICULTY_RANK, QUEST_GAIN_BY_RANK } from "./constants";

function outcomes(cleared: number, missed: number): QuestOutcome[] {
  return [
    ...Array<QuestOutcome>(cleared).fill("cleared"),
    ...Array<QuestOutcome>(missed).fill("missed"),
  ];
}

describe("ranks", () => {
  it("keeps ranks between 1 and 5 (6 and 7 are not used yet)", () => {
    expect(clampRank(0)).toBe(1);
    expect(clampRank(6)).toBe(5);
    expect(clampRank(7)).toBe(5);
    expect(MAX_DIFFICULTY_RANK).toBe(5);
    expect(isValidRank(3)).toBe(true);
    expect(isValidRank(6)).toBe(false);
    expect(isValidRank(2.5)).toBe(false);
    expect(isValidRank("2")).toBe(false);
  });

  it("makes main quests one rank harder and side quests one easier", () => {
    expect(rankFor("daily", 2)).toBe(2);
    expect(rankFor("main", 2)).toBe(3);
    expect(rankFor("side", 2)).toBe(1);
    expect(rankFor("main", 5)).toBe(5);
    expect(rankFor("side", 1)).toBe(1);
  });
});

describe("questGain", () => {
  it("follows the gain table, with main quests three times more", () => {
    for (let rank = 1; rank <= 5; rank++) {
      expect(questGain(rank, "daily")).toBe(QUEST_GAIN_BY_RANK[rank - 1]);
      expect(questGain(rank, "side")).toBe(QUEST_GAIN_BY_RANK[rank - 1]);
      expect(questGain(rank, "main")).toBe(QUEST_GAIN_BY_RANK[rank - 1] * 3);
    }
  });

  it("gives more points at every rank up", () => {
    for (let rank = 2; rank <= 5; rank++) {
      expect(questGain(rank, "daily")).toBeGreaterThan(questGain(rank - 1, "daily"));
    }
  });
});

describe("effortMinutes", () => {
  it("scales the time with rank and rounds to 5 minutes", () => {
    expect(effortMinutes(20, 1, "intelligence", 60)).toBe(10);
    expect(effortMinutes(20, 2, "intelligence", 60)).toBe(15);
    expect(effortMinutes(20, 3, "intelligence", 60)).toBe(20);
    expect(effortMinutes(20, 4, "intelligence", 60)).toBe(25);
    expect(effortMinutes(20, 5, "intelligence", 60)).toBe(30);
  });

  it("never asks for less than 5 minutes", () => {
    expect(effortMinutes(5, 1, "speed", 15)).toBe(5);
  });

  it("never asks for more than the whole daily time", () => {
    expect(effortMinutes(30, 5, "speed", 30)).toBe(30);
  });

  it("caps strength quests at 30 minutes", () => {
    expect(effortMinutes(60, 5, "strength", 60)).toBe(30);
    expect(effortMinutes(60, 5, "endurance", 60)).toBe(60);
  });
});

describe("successRate", () => {
  it("needs at least 6 quests to judge", () => {
    expect(successRate(outcomes(5, 0))).toBeNull();
    expect(successRate(outcomes(6, 0))).toBe(1);
  });

  it("is the share of quests cleared", () => {
    expect(successRate(outcomes(3, 1))).toBeNull();
    expect(successRate(outcomes(6, 2))).toBe(0.75);
  });
});

describe("nextDifficulty", () => {
  it("goes up one rank above 80%", () => {
    expect(nextDifficulty(2, outcomes(9, 1))).toBe(3);
    expect(nextDifficulty(2, outcomes(10, 0))).toBe(3);
  });

  it("goes down one rank below 70%", () => {
    expect(nextDifficulty(3, outcomes(6, 4))).toBe(2);
    expect(nextDifficulty(3, outcomes(0, 10))).toBe(2);
  });

  it("stays inside the 70 to 80% target", () => {
    expect(nextDifficulty(3, outcomes(7, 3))).toBe(3);
    expect(nextDifficulty(3, outcomes(8, 2))).toBe(3);
    expect(nextDifficulty(3, outcomes(6, 2))).toBe(3);
  });

  it("stays when there are too few quests", () => {
    expect(nextDifficulty(3, outcomes(5, 0))).toBe(3);
    expect(nextDifficulty(3, [])).toBe(3);
  });

  it("never leaves ranks 1 to 5", () => {
    expect(nextDifficulty(5, outcomes(10, 0))).toBe(5);
    expect(nextDifficulty(1, outcomes(0, 10))).toBe(1);
  });

  it("settles a user near the target over many weeks", () => {
    // A user who clears 90% at rank 2 and 75% at rank 3 and above.
    let rank = 2;
    for (let week = 0; week < 10; week++) {
      rank = rank <= 2 ? nextDifficulty(rank, outcomes(9, 1)) : nextDifficulty(rank, outcomes(15, 5));
    }
    expect(rank).toBe(3);
  });
});

describe("difficultyCheckDue", () => {
  it("is due when never checked", () => {
    expect(difficultyCheckDue(null, "2026-10-14")).toBe(true);
  });

  it("is due once per week, from Monday", () => {
    // 2026-10-12 is a Monday.
    expect(difficultyCheckDue("2026-10-12", "2026-10-18")).toBe(false);
    expect(difficultyCheckDue("2026-10-11", "2026-10-12")).toBe(true);
    expect(difficultyCheckDue("2026-10-14", "2026-10-19")).toBe(true);
  });
});
