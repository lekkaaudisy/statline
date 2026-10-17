import { describe, expect, it } from "vitest";
import {
  calibrationDay,
  calibrationLastDay,
  calibrationPhase,
  canRecalibrate,
  generatePlacementQuests,
  isStatSettlement,
  placementCount,
  placementForToday,
  placementsDue,
  questScore,
  recalibrationOpensOn,
  settleCalibration,
  settledPoints,
  settleGrade,
  statEvidence,
  weakerQuestion,
  type CalibrationQuest,
} from "./calibration";
import { CLASSES } from "./classes";
import {
  CALIBRATION_DAYS,
  DAILY_MINUTES_OPTIONS,
  HONOUR_MAX_RANK,
  SEASON_DAYS,
  STRENGTH_MAX_MINUTES,
} from "./constants";
import { addDays } from "./dates";
import { GOAL_PLACEMENTS, QUESTION_PLACEMENTS } from "./placement-templates";
import { EARNED_STATS, type EarnedStat, type Grade } from "./stats";

const START = "2026-10-14";
const ANSWERS = { S1: 2, S2: 0, P1: 1, P2: 3, E1: 1, E2: 1, I1: 3, I2: 2 };
const GRADES: Record<EarnedStat, Grade> = {
  strength: "D",
  speed: "C",
  endurance: "E",
  intelligence: "B",
};

function placements(dailyMinutes: 15 | 30 | 60 = 30, mainClass: (typeof CLASSES)[number] = "scholar") {
  return generatePlacementQuests({
    answers: ANSWERS,
    mainClass,
    goal: "Complete an online course",
    dailyMinutes,
    grades: GRADES,
  });
}

function quest(overrides: Partial<CalibrationQuest> = {}): CalibrationQuest {
  return {
    type: "daily",
    stat: "strength",
    status: "cleared",
    dueOn: START,
    completedOn: START,
    proof: "evidence",
    ...overrides,
  };
}

describe("calibration week", () => {
  it("counts the start day as day 1 and day 8 as the result day", () => {
    expect(calibrationDay(START, START)).toBe(1);
    expect(calibrationDay(START, addDays(START, 6))).toBe(7);
    expect(calibrationDay(START, addDays(START, 7))).toBe(8);
    expect(calibrationLastDay(START)).toBe(addDays(START, CALIBRATION_DAYS - 1));
  });

  it("is in the week until day 7, due from day 8, settled once settled", () => {
    expect(calibrationPhase({ startedOn: START, settledOn: null }, addDays(START, 6))).toBe("week");
    expect(calibrationPhase({ startedOn: START, settledOn: null }, addDays(START, 7))).toBe("due");
    expect(calibrationPhase({ startedOn: START, settledOn: addDays(START, 7) }, addDays(START, 9))).toBe("settled");
  });
});

describe("placement quests", () => {
  it("gives 5, 6 or 7 placement quests by daily time", () => {
    expect(placementCount(15)).toBe(5);
    expect(placementCount(30)).toBe(6);
    expect(placementCount(60)).toBe(7);
    for (const minutes of DAILY_MINUTES_OPTIONS) {
      expect(placements(minutes)).toHaveLength(placementCount(minutes));
    }
  });

  it("tests every earned stat once, plus the Class goal", () => {
    for (const minutes of DAILY_MINUTES_OPTIONS) {
      const all = placements(minutes);
      const statQuests = all.filter((p) => !p.countsForClass);
      expect(new Set(statQuests.map((p) => p.stat))).toEqual(new Set(EARNED_STATS));
      const goalQuests = all.filter((p) => p.countsForClass);
      expect(goalQuests).toHaveLength(placementCount(minutes) - 4);
      for (const p of goalQuests) expect(p.title).toContain("Complete an online course");
    }
  });

  it("starts with the goal quest and numbers the days 1 to N", () => {
    const all = placements(60);
    expect(all[0].templateId).toBe(GOAL_PLACEMENTS.scholar[0].id);
    expect(all.map((p) => p.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(all.map((p) => p.slot)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("tests the stat with the lowest grade first", () => {
    const statQuests = placements(15).filter((p) => !p.countsForClass);
    expect(statQuests.map((p) => p.stat)).toEqual(["endurance", "strength", "speed", "intelligence"]);
  });

  it("picks each stat's quest from its lower-scoring question", () => {
    expect(weakerQuestion("strength", ANSWERS)).toBe("S2");
    expect(weakerQuestion("speed", ANSWERS)).toBe("P1");
    expect(weakerQuestion("intelligence", ANSWERS)).toBe("I2");
    // A tie goes to the first question.
    expect(weakerQuestion("endurance", ANSWERS)).toBe("E1");
    const ids = placements().map((p) => p.templateId);
    expect(ids).toContain(QUESTION_PLACEMENTS.S2.id);
    expect(ids).not.toContain(QUESTION_PLACEMENTS.S1.id);
  });

  it("sets each rank from the grade it tests, never above 4", () => {
    const byStat = Object.fromEntries(
      placements(15).filter((p) => !p.countsForClass).map((p) => [p.stat, p.rank]),
    );
    expect(byStat).toEqual({ endurance: 1, strength: 2, speed: 3, intelligence: 4 });
    const high = generatePlacementQuests({
      answers: ANSWERS,
      mainClass: "fighter",
      goal: "Run 5 km",
      dailyMinutes: 60,
      grades: { strength: "SSS", speed: "S", endurance: "A", intelligence: "B" },
    });
    for (const p of high) {
      expect(p.rank).toBeLessThanOrEqual(HONOUR_MAX_RANK);
      expect(p.allowedProofs).toContain("honour");
    }
  });

  it("caps strength minutes and fills every placeholder", () => {
    for (const c of CLASSES) {
      for (const minutes of DAILY_MINUTES_OPTIONS) {
        for (const p of placements(minutes, c)) {
          expect(p.title).not.toMatch(/\{|\}/);
          expect(p.type).toBe("placement");
          if (p.stat === "strength" && p.minutes !== null) {
            expect(p.minutes).toBeLessThanOrEqual(STRENGTH_MAX_MINUTES);
          }
        }
      }
    }
  });

  it("gives the same quests for the same inputs", () => {
    expect(placements()).toEqual(placements());
  });

  it("gives placement quests on their day and catches up missed visits", () => {
    const all = placements(60);
    expect(placementsDue(all, START, START, new Set()).map((p) => p.slot)).toEqual([1]);
    expect(placementsDue(all, START, addDays(START, 3), new Set([1])).map((p) => p.slot)).toEqual([2, 3, 4]);
    expect(placementsDue(all, START, addDays(START, 6), new Set([1, 2, 3, 4, 5, 6, 7]))).toEqual([]);
  });

  it("gives none before the start or after day 7", () => {
    const all = placements(60);
    expect(placementsDue(all, START, addDays(START, -1), new Set())).toEqual([]);
    expect(placementsDue(all, START, addDays(START, 7), new Set())).toEqual([]);
  });

  it("finds today's planned placement quest", () => {
    const all = placements(15);
    expect(placementForToday(all, START, addDays(START, 2))?.slot).toBe(3);
    expect(placementForToday(all, START, addDays(START, 5))).toBeNull();
  });
});

describe("proof score", () => {
  it("scores a cleared quest by its proof weight", () => {
    expect(questScore(quest({ proof: "auto" }), START)).toBe(1);
    expect(questScore(quest({ proof: "crew" }), START)).toBe(1);
    expect(questScore(quest({ proof: "evidence" }), START)).toBe(0.8);
    expect(questScore(quest({ proof: "honour" }), START)).toBe(0.5);
  });

  it("scores a missed daily, side or main quest as 0", () => {
    for (const type of ["daily", "side", "main"]) {
      expect(questScore(quest({ type, status: "missed", completedOn: null, proof: null }), START)).toBe(0);
    }
  });

  it("never counts a skipped placement quest", () => {
    expect(
      questScore(quest({ type: "placement", status: "missed", completedOn: null, proof: null }), START),
    ).toBeNull();
  });

  it("does not count rested, excused, shielded, rerolled or open quests", () => {
    for (const status of ["rested", "excused", "shielded", "rerolled", "open"]) {
      expect(questScore(quest({ status, completedOn: null, proof: null }), START)).toBeNull();
    }
  });

  it("only counts quests from days 1 to 7", () => {
    expect(questScore(quest({ completedOn: addDays(START, -1) }), START)).toBeNull();
    expect(questScore(quest({ completedOn: addDays(START, 6) }), START)).toBe(0.8);
    expect(questScore(quest({ completedOn: addDays(START, 7) }), START)).toBeNull();
    expect(
      questScore(quest({ status: "missed", dueOn: addDays(START, 7), completedOn: null, proof: null }), START),
    ).toBeNull();
  });

  it("averages one stat's quests and ignores the others", () => {
    const evidence = statEvidence(
      [
        quest({ proof: "evidence" }),
        quest({ proof: "honour" }),
        quest({ stat: "speed", status: "missed", completedOn: null, proof: null }),
      ],
      "strength",
      START,
    );
    expect(evidence).toEqual({ score: 0.65, counted: 2 });
  });

  it("gives no score with fewer than 2 counted quests", () => {
    expect(statEvidence([quest()], "strength", START)).toEqual({ score: null, counted: 1 });
    expect(statEvidence([], "strength", START)).toEqual({ score: null, counted: 0 });
  });
});

describe("settling a grade", () => {
  it("goes up one step at 0.7 or more", () => {
    expect(settleGrade("C", { score: 0.7, counted: 2 })).toBe("B");
    expect(settleGrade("C", { score: 1, counted: 5 })).toBe("B");
  });

  it("can pass the B cap, because the grade is now proven", () => {
    expect(settleGrade("B", { score: 0.8, counted: 3 })).toBe("A");
  });

  it("stays from 0.35 up to 0.7", () => {
    expect(settleGrade("C", { score: 0.35, counted: 2 })).toBe("C");
    expect(settleGrade("C", { score: 0.69, counted: 2 })).toBe("C");
  });

  it("goes down one step below 0.35, never below F", () => {
    expect(settleGrade("C", { score: 0.34, counted: 2 })).toBe("D");
    expect(settleGrade("C", { score: 0, counted: 4 })).toBe("D");
    expect(settleGrade("F", { score: 0, counted: 4 })).toBe("F");
  });

  it("stays without enough proof", () => {
    expect(settleGrade("B", { score: null, counted: 0 })).toBe("B");
  });

  it("never moves more than one step at the top of the ladder", () => {
    expect(settleGrade("SSS", { score: 1, counted: 5 })).toBe("SSS");
  });
});

describe("settled points", () => {
  it("rises to the bottom of a higher grade", () => {
    expect(settledPoints(90, "B")).toBe(110);
  });

  it("drops to the top of the lower grade", () => {
    expect(settledPoints(90, "D")).toBe(74);
  });

  it("keeps the points when the grade stays", () => {
    expect(settledPoints(90, "C")).toBe(90);
  });
});

describe("settling calibration", () => {
  it("settles every earned stat from its own proof", () => {
    const points = { strength: 50, speed: 80, endurance: 30, intelligence: 115 };
    const quests: CalibrationQuest[] = [
      // Strength: two placement quests with photos: 0.8, up.
      quest({ type: "placement", stat: "strength" }),
      quest({ type: "placement", stat: "strength" }),
      // Speed: two honour check-offs: 0.5, stays.
      quest({ stat: "speed", proof: "honour" }),
      quest({ stat: "speed", proof: "honour" }),
      // Endurance: one honour clear and three missed dailies: 0.125, down.
      quest({ stat: "endurance", proof: "honour" }),
      ...[0, 1, 2].map(() => quest({ stat: "endurance", status: "missed", completedOn: null, proof: null })),
      // Intelligence: everything skipped: not enough proof, stays.
      quest({ type: "placement", stat: "intelligence", status: "missed", completedOn: null, proof: null }),
    ];
    const result = settleCalibration({ points, quests, startedOn: START });
    expect(result.strength).toEqual({ before: "D", after: "C", points: 75, score: 0.8, counted: 2 });
    expect(result.speed).toEqual({ before: "C", after: "C", points: 80, score: 0.5, counted: 2 });
    expect(result.endurance).toEqual({ before: "E", after: "F", points: 19, score: 0.13, counted: 4 });
    expect(result.intelligence).toEqual({ before: "B", after: "B", points: 115, score: null, counted: 0 });
  });

  it("produces results the screens can read back", () => {
    const result = settleCalibration({
      points: { strength: 0, speed: 0, endurance: 0, intelligence: 0 },
      quests: [],
      startedOn: START,
    });
    for (const stat of EARNED_STATS) expect(isStatSettlement(result[stat])).toBe(true);
    expect(isStatSettlement({ before: "X" })).toBe(false);
    expect(isStatSettlement(null)).toBe(false);
  });
});

describe("recalibration", () => {
  it("opens one season after the last calibration started", () => {
    expect(recalibrationOpensOn(START)).toBe(addDays(START, SEASON_DAYS));
  });

  it("is allowed once per season, never during a calibration", () => {
    const settled = { startedOn: START, settledOn: addDays(START, 7) };
    expect(canRecalibrate(settled, addDays(START, SEASON_DAYS - 1))).toBe(false);
    expect(canRecalibrate(settled, addDays(START, SEASON_DAYS))).toBe(true);
    expect(canRecalibrate({ startedOn: START, settledOn: null }, addDays(START, 200))).toBe(false);
    expect(canRecalibrate(null, START)).toBe(false);
  });
});
