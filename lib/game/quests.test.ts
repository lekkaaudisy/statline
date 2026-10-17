import { describe, expect, it } from "vitest";
import { CLASSES, type ClassId } from "./classes";
import {
  DAILY_MINUTES_OPTIONS,
  HONOUR_MAX_RANK,
  STRENGTH_MAX_DAYS_PER_WEEK,
  STRENGTH_MAX_MINUTES,
} from "./constants";
import { addDays } from "./dates";
import { questGain } from "./difficulty";
import { BALANCE_TEMPLATES, CLASS_TEMPLATES } from "./quest-templates";
import {
  canCreateSideQuest,
  classShare,
  generateMainQuest,
  nextIsClassQuest,
  planQuests,
  statsByWeakness,
  weakestStat,
  validateSideQuest,
  type DailyMinutes,
  type ExistingQuest,
  type Player,
  type QuestDraft,
} from "./quests";
import { seededRandom } from "./random";
import { EARNED_STATS, type EarnedStat } from "./stats";

const MONDAY = "2026-10-12";
const USER = "user-1";

function player(overrides: Partial<Player> = {}): Player {
  return {
    mainClass: "scholar",
    secondClass: null,
    goal: "Complete an online course",
    dailyMinutes: 30,
    rank: 2,
    points: { strength: 50, speed: 80, endurance: 40, intelligence: 100 },
    ...overrides,
  };
}

function toExisting(q: QuestDraft): ExistingQuest {
  return { type: q.type, source: "system", issuedOn: q.issuedOn, templateId: q.templateId, countsForClass: q.countsForClass };
}

// Plans `days` days in a row, starting on a Monday, with points shifting.
function simulate(p: Player, days: number, seed = USER): QuestDraft[] {
  const all: QuestDraft[] = [];
  const random = seededRandom(`points:${seed}`);
  for (let d = 0; d < days; d++) {
    const today = addDays(MONDAY, d);
    const points = Object.fromEntries(
      EARNED_STATS.map((s) => [s, Math.floor(random() * 200)]),
    ) as Record<EarnedStat, number>;
    all.push(
      ...planQuests({ seed, today, player: { ...p, points }, existing: all.map(toExisting), restDay: d % 7 === 6 }),
    );
  }
  return all;
}

describe("weakest stat", () => {
  it("sorts stats from weakest to strongest", () => {
    expect(statsByWeakness({ strength: 50, speed: 80, endurance: 40, intelligence: 100 })).toEqual([
      "endurance",
      "strength",
      "speed",
      "intelligence",
    ]);
  });

  it("breaks ties in the usual stat order", () => {
    expect(weakestStat({ strength: 10, speed: 10, endurance: 10, intelligence: 10 })).toBe("strength");
  });
});

describe("daily quests", () => {
  it("gives 1, 2 or 3 dailies for 15, 30 or 60 minutes", () => {
    const expected: Record<DailyMinutes, number> = { 15: 1, 30: 2, 60: 3 };
    for (const minutes of DAILY_MINUTES_OPTIONS) {
      const quests = planQuests({ seed: USER, today: MONDAY, player: player({ dailyMinutes: minutes }), existing: [], restDay: false });
      expect(quests.filter((q) => q.type === "daily")).toHaveLength(expected[minutes]);
    }
  });

  it("aims the first daily at the weakest stat", () => {
    for (const mainClass of CLASSES) {
      for (const stat of EARNED_STATS) {
        const points = { strength: 100, speed: 100, endurance: 100, intelligence: 100, [stat]: 10 };
        const quests = planQuests({ seed: USER, today: MONDAY, player: player({ mainClass, points }), existing: [], restDay: false });
        const first = quests.find((q) => q.type === "daily" && q.slot === 1);
        expect(first?.stat, `${mainClass} ${stat}`).toBe(stat);
      }
    }
  });

  it("aims later dailies at the next weakest stats", () => {
    const quests = planQuests({
      seed: USER,
      today: MONDAY,
      player: player({ dailyMinutes: 60, points: { strength: 50, speed: 80, endurance: 40, intelligence: 100 } }),
      existing: [],
      restDay: false,
    });
    const dailies = quests.filter((q) => q.type === "daily").map((q) => q.stat);
    expect(dailies).toEqual(["endurance", "strength", "speed"]);
  });

  it("gives no dailies on the rest day, but still offers the side quest", () => {
    const quests = planQuests({ seed: USER, today: MONDAY, player: player(), existing: [], restDay: true });
    expect(quests.filter((q) => q.type === "daily")).toHaveLength(0);
    expect(quests.filter((q) => q.type === "side")).toHaveLength(1);
  });

  it("gives one fewer daily on a calibration day, aimed away from the placement stat", () => {
    for (const minutes of [15, 30, 60] as const) {
      const quests = planQuests({
        seed: USER,
        today: MONDAY,
        player: player({ dailyMinutes: minutes }),
        existing: [],
        restDay: false,
        placementStat: "endurance",
      });
      const dailies = quests.filter((q) => q.type === "daily");
      expect(dailies).toHaveLength({ 15: 0, 30: 1, 60: 2 }[minutes]);
      // Endurance is the weakest stat, but the placement quest already trains it.
      for (const q of dailies) expect(q.stat).not.toBe("endurance");
      expect(quests.filter((q) => q.type === "side")).toHaveLength(1);
    }
  });

  it("keeps the one-strength-quest-a-day cap with a strength placement quest", () => {
    const quests = planQuests({
      seed: USER,
      today: MONDAY,
      player: player({ dailyMinutes: 60, points: { strength: 0, speed: 200, endurance: 200, intelligence: 200 } }),
      existing: [],
      restDay: false,
      placementStat: "strength",
    });
    expect(quests.filter((q) => q.type !== "main" && q.stat === "strength")).toHaveLength(0);
  });

  it("is due the same day, at the player's rank, with the rank's points", () => {
    const quests = planQuests({ seed: USER, today: MONDAY, player: player({ rank: 3 }), existing: [], restDay: false });
    for (const q of quests.filter((q) => q.type === "daily")) {
      expect(q.issuedOn).toBe(MONDAY);
      expect(q.dueOn).toBe(MONDAY);
      expect(q.rank).toBe(3);
      expect(q.gain).toBe(questGain(3, "daily"));
    }
  });

  it("gives the same quests every time for the same day", () => {
    const a = planQuests({ seed: USER, today: MONDAY, player: player(), existing: [], restDay: false });
    const b = planQuests({ seed: USER, today: MONDAY, player: player(), existing: [], restDay: false });
    expect(a).toEqual(b);
  });

  it("varies quests from day to day", () => {
    const quests = simulate(player({ dailyMinutes: 60 }), 14);
    const ids = new Set(quests.filter((q) => q.type === "daily").map((q) => q.templateId));
    expect(ids.size).toBeGreaterThan(8);
  });

  it("never repeats a template on the same day", () => {
    const quests = simulate(player({ dailyMinutes: 60, secondClass: "monk" }), 28);
    for (let d = 0; d < 28; d++) {
      const day = quests.filter((q) => q.issuedOn === addDays(MONDAY, d) && q.type !== "main");
      expect(new Set(day.map((q) => q.templateId)).size).toBe(day.length);
    }
  });

  it("does not issue today's quests twice", () => {
    const first = planQuests({ seed: USER, today: MONDAY, player: player(), existing: [], restDay: false });
    const again = planQuests({ seed: USER, today: MONDAY, player: player(), existing: first.map(toExisting), restDay: false });
    expect(again).toEqual([]);
  });
});

describe("the 60/40 rule", () => {
  it("keeps every week near 60% Class quests for every Class and daily time", () => {
    for (const mainClass of CLASSES) {
      for (const dailyMinutes of DAILY_MINUTES_OPTIONS) {
        for (const secondClass of [null, mainClass === "monk" ? "leader" : "monk"] as (ClassId | null)[]) {
          const quests = simulate(player({ mainClass, secondClass, dailyMinutes }), 28, `${mainClass}-${dailyMinutes}`);
          for (let w = 0; w < 4; w++) {
            const week = quests.filter((q) => q.issuedOn >= addDays(MONDAY, w * 7) && q.issuedOn < addDays(MONDAY, w * 7 + 7));
            const share = classShare(week);
            expect(share, `${mainClass} ${dailyMinutes} week ${w}`).toBeGreaterThanOrEqual(0.5);
            expect(share, `${mainClass} ${dailyMinutes} week ${w}`).toBeLessThanOrEqual(0.7);
          }
        }
      }
    }
  });

  it("picks whichever source keeps the share closer to 60%", () => {
    expect(nextIsClassQuest({ classQuests: 0, otherQuests: 0 })).toBe(true);
    expect(nextIsClassQuest({ classQuests: 1, otherQuests: 0 })).toBe(false);
    expect(nextIsClassQuest({ classQuests: 1, otherQuests: 1 })).toBe(true);
    expect(nextIsClassQuest({ classQuests: 6, otherQuests: 3 })).toBe(false);
    expect(nextIsClassQuest({ classQuests: 5, otherQuests: 4 })).toBe(true);
  });

  it("draws Class quests from the Class library and the rest from the balance pool", () => {
    const quests = simulate(player({ mainClass: "fighter" }), 7);
    const fighterIds = new Set(CLASS_TEMPLATES.fighter.map((t) => t.id));
    const balanceIds = new Set(BALANCE_TEMPLATES.map((t) => t.id));
    for (const q of quests.filter((q) => q.type !== "main")) {
      expect(q.countsForClass ? fighterIds.has(q.templateId) : balanceIds.has(q.templateId)).toBe(true);
    }
  });

  it("uses the second Class for some Class quests", () => {
    const quests = simulate(player({ mainClass: "scholar", secondClass: "monk" }), 28);
    const monkIds = new Set(CLASS_TEMPLATES.monk.map((t) => t.id));
    const fromMonk = quests.filter((q) => monkIds.has(q.templateId)).length;
    const classQuests = quests.filter((q) => q.countsForClass && q.type !== "main").length;
    expect(fromMonk).toBeGreaterThan(0);
    expect(fromMonk).toBeLessThan(classQuests / 2);
  });
});

describe("side quests", () => {
  it("offers one optional System side quest a day, one rank easier", () => {
    const quests = planQuests({ seed: USER, today: MONDAY, player: player({ rank: 3 }), existing: [], restDay: false });
    const side = quests.filter((q) => q.type === "side");
    expect(side).toHaveLength(1);
    expect(side[0].rank).toBe(2);
    expect(side[0].dueOn).toBe(MONDAY);
  });

  it("trains a stat the dailies did not", () => {
    for (const dailyMinutes of DAILY_MINUTES_OPTIONS) {
      const quests = simulate(player({ dailyMinutes }), 14);
      for (let d = 0; d < 14; d++) {
        const day = quests.filter((q) => q.issuedOn === addDays(MONDAY, d));
        const side = day.find((q) => q.type === "side")!;
        expect(day.filter((q) => q.type === "daily").map((q) => q.stat)).not.toContain(side.stat);
      }
    }
  });
});

describe("main quest", () => {
  it("is issued once a week, from Monday to Sunday, one rank harder", () => {
    const quests = simulate(player({ rank: 2 }), 14);
    const mains = quests.filter((q) => q.type === "main");
    expect(mains).toHaveLength(2);
    expect(mains[0].issuedOn).toBe(MONDAY);
    expect(mains[0].dueOn).toBe(addDays(MONDAY, 6));
    expect(mains[0].rank).toBe(3);
    expect(mains[0].gain).toBe(questGain(3, "main"));
    expect(mains[0].countsForClass).toBe(true);
  });

  it("is built from the goal and the main Class's stat", () => {
    const main = generateMainQuest(player({ mainClass: "fighter", goal: "Run 5 km without stopping" }), MONDAY, seededRandom("x"));
    expect(main.title).toContain('"Run 5 km without stopping"');
    expect(main.stat).toBe("strength");
  });

  it("is issued mid-week for a player who joins mid-week, still from Monday", () => {
    const quests = planQuests({ seed: USER, today: addDays(MONDAY, 3), player: player(), existing: [], restDay: false });
    const main = quests.find((q) => q.type === "main")!;
    expect(main.issuedOn).toBe(MONDAY);
  });
});

describe("safety", () => {
  it("gives at most one strength quest a day, capped at 30 minutes", () => {
    for (const mainClass of CLASSES) {
      const quests = simulate(
        player({ mainClass, dailyMinutes: 60, rank: 5, points: { strength: 0, speed: 0, endurance: 0, intelligence: 0 } }),
        14,
      );
      for (let d = 0; d < 14; d++) {
        const strength = quests.filter((q) => q.issuedOn === addDays(MONDAY, d) && q.type !== "main" && q.stat === "strength");
        expect(strength.length, `${mainClass} day ${d}`).toBeLessThanOrEqual(1);
      }
      for (const q of quests.filter((q) => q.stat === "strength")) {
        expect(q.minutes ?? 0).toBeLessThanOrEqual(STRENGTH_MAX_MINUTES);
      }
    }
  });

  it("never asks for more than 5 strength days in a main quest", () => {
    for (let rank = 1; rank <= 5; rank++) {
      const main = generateMainQuest(player({ mainClass: "fighter", rank }), MONDAY, seededRandom(`r${rank}`));
      const days = Number(main.title.match(/(\d+) (days|sessions)/)?.[1]);
      expect(days).toBeLessThanOrEqual(STRENGTH_MAX_DAYS_PER_WEEK);
    }
  });

  it("never offers honour proof above rank 4", () => {
    for (let rank = 1; rank <= 5; rank++) {
      for (const q of simulate(player({ rank, dailyMinutes: 60 }), 7)) {
        expect(q.allowedProofs.includes("honour")).toBe(q.rank <= HONOUR_MAX_RANK);
      }
    }
  });
});

describe("user side quests", () => {
  it("accepts a safe title, an earned stat and rank 1 to 3", () => {
    expect(validateSideQuest({ title: "  Fix the  bike chain ", stat: "speed", rank: 2 })).toEqual({
      ok: true,
      value: { title: "Fix the bike chain", stat: "speed", rank: 2 },
    });
  });

  it("refuses ranks above 3 and invalid ranks", () => {
    expect(validateSideQuest({ title: "Fix the bike", stat: "speed", rank: 4 }).ok).toBe(false);
    expect(validateSideQuest({ title: "Fix the bike", stat: "speed", rank: 0 }).ok).toBe(false);
    expect(validateSideQuest({ title: "Fix the bike", stat: "speed", rank: "2" }).ok).toBe(false);
  });

  it("refuses Potential, which is never earned directly", () => {
    expect(validateSideQuest({ title: "Fix the bike", stat: "potential", rank: 1 }).ok).toBe(false);
  });

  it("refuses unsafe titles", () => {
    for (const title of ["Lose 2 kg this week", "Eat under 1500 calories", "Fasting until dinner"]) {
      const result = validateSideQuest({ title, stat: "strength", rank: 1 });
      expect(result.ok, title).toBe(false);
    }
  });

  it("refuses empty or overlong titles", () => {
    expect(validateSideQuest({ title: "  ", stat: "speed", rank: 1 }).ok).toBe(false);
    expect(validateSideQuest({ title: "x".repeat(81), stat: "speed", rank: 1 }).ok).toBe(false);
    expect(validateSideQuest(null).ok).toBe(false);
  });

  it("allows 3 a day", () => {
    expect(canCreateSideQuest(2)).toBe(true);
    expect(canCreateSideQuest(3)).toBe(false);
  });
});
