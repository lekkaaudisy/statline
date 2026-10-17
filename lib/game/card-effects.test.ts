import { describe, expect, it } from "vitest";
import {
  cardUseError,
  cardUsedMessage,
  nextSkillSteps,
  questlineProgress,
  rerollQuest,
  rerollTargets,
  restTargets,
  shieldDay,
  withDoubleXp,
  type EffectQuest,
} from "./card-effects";
import type { Card, CardKind, CardStatus } from "./cards";
import { seededRandom } from "./random";
import type { Player } from "./quests";

const TODAY = "2026-10-14";

function quest(over: Partial<EffectQuest> = {}): EffectQuest {
  return {
    id: "q1",
    type: "daily",
    source: "system",
    status: "open",
    templateId: "fighter-1",
    stat: "strength",
    rank: 2,
    countsForClass: true,
    issuedOn: TODAY,
    dueOn: TODAY,
    slot: 1,
    cardId: null,
    ...over,
  };
}

function card(kind: CardKind, status: CardStatus = "held", over: Partial<Card> = {}) {
  return {
    id: `${kind}-${status}`,
    kind,
    status,
    questlineId: null,
    questlineLength: null,
    questlineStep: 0,
    activatedOn: null,
    treat: null,
    ...over,
  };
}

const player: Player = {
  mainClass: "fighter",
  secondClass: null,
  goal: "Run 5 km",
  dailyMinutes: 30,
  rank: 2,
  points: { strength: 10, speed: 20, endurance: 30, intelligence: 40 },
};

const context = (over: Partial<Parameters<typeof cardUseError>[1]> = {}) => ({
  today: TODAY,
  quests: [quest()],
  cards: [],
  restToday: false,
  ...over,
});

describe("using cards", () => {
  it("never uses Proof cards or cards not in the hand", () => {
    expect(cardUseError(card("day_one"), context())).toMatch(/Proof/);
    expect(cardUseError(card("reroll", "pending"), context())).not.toBeNull();
  });

  it("Reroll needs an open daily or System side quest today", () => {
    expect(cardUseError(card("reroll"), context())).toBeNull();
    expect(cardUseError(card("reroll"), context({ quests: [quest({ status: "cleared" })] }))).not.toBeNull();
    expect(cardUseError(card("reroll"), context({ quests: [quest({ type: "main" })] }))).not.toBeNull();
    expect(cardUseError(card("reroll"), context({ quests: [quest({ type: "side", source: "user", templateId: null })] }))).not.toBeNull();
  });

  it("Rest needs open dailies and a day that is not already a rest day", () => {
    expect(cardUseError(card("rest"), context())).toBeNull();
    expect(cardUseError(card("rest"), context({ restToday: true }))).toMatch(/already/);
    expect(cardUseError(card("rest"), context({ quests: [quest({ type: "side" })] }))).not.toBeNull();
  });

  it("allows one active Double XP and one active Shield", () => {
    expect(cardUseError(card("double_xp"), context())).toBeNull();
    expect(cardUseError(card("double_xp"), context({ cards: [card("double_xp", "active")] }))).not.toBeNull();
    expect(cardUseError(card("shield"), context({ cards: [card("shield", "active")] }))).not.toBeNull();
    expect(cardUseError(card("shield"), context({ cards: [card("double_xp", "active")] }))).toBeNull();
  });

  it("always redeems Reward cards", () => {
    expect(cardUseError(card("reward", "held", { treat: "Game night" }), context())).toBeNull();
  });

  it("opens at most 3 questlines at once", () => {
    const skill = card("skill", "held", { questlineId: "fighter-boxing" });
    expect(cardUseError(skill, context())).toBeNull();
    const open = [1, 2, 3].map((i) => ({ ...card("skill", "active"), id: `s${i}` }));
    expect(cardUseError(skill, context({ cards: open }))).toMatch(/3 questlines/);
    expect(cardUseError(card("skill", "held", { questlineId: "gone" }), context())).not.toBeNull();
  });
});

describe("Reroll", () => {
  it("targets only today's open daily and System side quests", () => {
    const quests = [
      quest({ id: "a" }),
      quest({ id: "b", type: "side" }),
      quest({ id: "c", type: "main" }),
      quest({ id: "d", issuedOn: "2026-10-13" }),
      quest({ id: "e", source: "user", type: "side" }),
    ];
    expect(rerollTargets(quests, TODAY).map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("swaps in a different quest with the same type, rank, slot and day", () => {
    const target = quest({ templateId: "fighter-1", slot: 2 });
    const next = rerollQuest({ target, todayQuests: [target], player, random: seededRandom("r") })!;
    expect(next.templateId).not.toBe("fighter-1");
    expect(next.templateId.startsWith("fighter-")).toBe(true);
    expect(next).toMatchObject({ type: "daily", rank: 2, gain: 6, slot: 2, issuedOn: TODAY, dueOn: TODAY, countsForClass: true });
    // Prefers the same stat.
    expect(next.stat).toBe("strength");
  });

  it("keeps balance quests in the balance pool", () => {
    const target = quest({ templateId: "balance-intelligence-1", stat: "intelligence", countsForClass: false });
    const next = rerollQuest({ target, todayQuests: [target], player, random: seededRandom("b") })!;
    expect(next.templateId.startsWith("balance-")).toBe(true);
    expect(next.countsForClass).toBe(false);
  });

  it("keeps one strength quest a day", () => {
    const strength = quest({ id: "s", templateId: "fighter-2", stat: "strength", slot: 1 });
    const target = quest({ id: "t", templateId: "fighter-10", stat: "intelligence", slot: 2 });
    for (let i = 0; i < 20; i++) {
      const next = rerollQuest({ target, todayQuests: [strength, target], player, random: seededRandom(`s${i}`) })!;
      expect(next.stat).not.toBe("strength");
    }
  });

  it("never repeats a quest already given today", () => {
    const today = Array.from({ length: 11 }, (_, i) => quest({ id: `q${i}`, templateId: `fighter-${i + 1}` }));
    const next = rerollQuest({ target: today[0], todayQuests: today, player, random: seededRandom("x") });
    expect(next?.templateId).toBe("fighter-12");
  });

  it("refuses main quests", () => {
    expect(rerollQuest({ target: quest({ type: "main" }), todayQuests: [], player, random: seededRandom("m") })).toBeNull();
  });
});

describe("Rest", () => {
  it("rests today's open daily quests only", () => {
    const quests = [
      quest({ id: "a" }),
      quest({ id: "b", status: "cleared" }),
      quest({ id: "c", type: "side" }),
      quest({ id: "d", issuedOn: "2026-10-13" }),
    ];
    expect(restTargets(quests, TODAY).map((q) => q.id)).toEqual(["a"]);
  });
});

describe("Double XP", () => {
  it("doubles the points only while active", () => {
    expect(withDoubleXp(7, true)).toBe(14);
    expect(withDoubleXp(7, false)).toBe(7);
  });
});

describe("Shield", () => {
  const missed = (dueOn: string, type: EffectQuest["type"] = "daily", penalty: string | null = null) => ({
    type,
    status: "missed",
    dueOn,
    penalty,
  });

  it("covers the first missed day from the day it was raised", () => {
    expect(shieldDay("2026-10-12", [missed("2026-10-14"), missed("2026-10-13")])).toBe("2026-10-13");
  });

  it("never covers days before it was raised", () => {
    expect(shieldDay("2026-10-12", [missed("2026-10-11")])).toBeNull();
  });

  it("covers a missed main quest", () => {
    expect(shieldDay("2026-10-12", [missed("2026-10-18", "main")])).toBe("2026-10-18");
  });

  it("is not used up by side quests, Skill steps or penalised quests", () => {
    expect(
      shieldDay("2026-10-12", [
        missed("2026-10-13", "side"),
        missed("2026-10-13", "skill"),
        missed("2026-10-14", "main", "card"),
        { type: "daily", status: "cleared", dueOn: "2026-10-13", penalty: null },
      ]),
    ).toBeNull();
  });
});

describe("Skill questlines", () => {
  const open = card("skill", "active", { id: "k1", questlineId: "fighter-boxing", questlineStep: 0 });

  it("gives the first step once a questline is open", () => {
    const [step] = nextSkillSteps([open], [], TODAY);
    expect(step).toMatchObject({
      type: "skill",
      cardId: "k1",
      templateId: "skill-fighter-boxing-1",
      rank: 1,
      gain: 4,
      allowedProofs: ["evidence", "honour"],
      issuedOn: TODAY,
      dueOn: "2026-10-16",
      slot: 1,
    });
  });

  it("gives one step a day, and only when no step is still open", () => {
    const given = quest({ type: "skill", cardId: "k1", issuedOn: TODAY, dueOn: "2026-10-16" });
    expect(nextSkillSteps([open], [given], TODAY)).toEqual([]);
    const stillOpen = quest({ type: "skill", cardId: "k1", issuedOn: "2026-10-13", dueOn: "2026-10-15" });
    expect(nextSkillSteps([open], [stillOpen], TODAY)).toEqual([]);
  });

  it("moves on after a cleared step, and repeats a step that ran out", () => {
    const after = { ...open, questlineStep: 1 };
    const cleared = quest({ type: "skill", cardId: "k1", status: "cleared", issuedOn: "2026-10-13" });
    expect(nextSkillSteps([after], [cleared], TODAY)[0].templateId).toBe("skill-fighter-boxing-2");
    const ranOut = quest({ type: "skill", cardId: "k1", status: "missed", issuedOn: "2026-10-10", dueOn: "2026-10-12" });
    expect(nextSkillSteps([open], [ranOut], TODAY)[0].templateId).toBe("skill-fighter-boxing-1");
  });

  it("stops after the last step", () => {
    expect(nextSkillSteps([{ ...open, questlineStep: 6 }], [], TODAY)).toEqual([]);
  });

  it("gives each open questline its own slot", () => {
    const other = { ...open, id: "k2", questlineId: "fighter-runwalk" };
    const taken = quest({ type: "skill", cardId: "k9", stat: "speed", slot: 1, issuedOn: TODAY, dueOn: "2026-10-16" });
    expect(nextSkillSteps([open, other], [taken], TODAY).map((s) => s.slot)).toEqual([2, 3]);
  });

  it("holds a strength step back on a day with another strength quest", () => {
    const runwalk = { ...open, questlineId: "fighter-runwalk", questlineStep: 1 };
    const strengthDaily = quest({ id: "d", stat: "strength" });
    expect(nextSkillSteps([runwalk], [strengthDaily], TODAY)).toEqual([]);
    expect(nextSkillSteps([runwalk], [quest({ id: "d", stat: "speed" })], TODAY)).toHaveLength(1);
    // Two strength steps never land on the same day.
    const boxing = { ...open, id: "k2", questlineStep: 0 };
    expect(nextSkillSteps([runwalk, boxing], [], TODAY)).toHaveLength(1);
  });

  it("ignores cards that are not open questlines", () => {
    expect(nextSkillSteps([card("skill", "held", { questlineId: "fighter-boxing" })], [], TODAY)).toEqual([]);
  });

  it("shows progress", () => {
    expect(questlineProgress({ ...open, questlineStep: 2 })).toEqual({ step: 2, total: 6 });
  });
});

describe("messages after use", () => {
  it("names the treat for Reward cards", () => {
    expect(cardUsedMessage({ kind: "reward", treat: "Game night", questlineId: null })).toContain("Game night");
  });

  it("names the questline for Skill cards", () => {
    expect(cardUsedMessage({ kind: "skill", treat: null, questlineId: "monk-breath" })).toContain("Breath and Stillness");
  });
});
