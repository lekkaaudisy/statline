import { describe, expect, it } from "vitest";
import { availableQuestlines, dropWeights, pickWeighted, rollCard } from "./card-drops";
import { DROP_KINDS } from "./cards";
import { CARD_DROP_WEIGHTS } from "./constants";
import { seededRandom } from "./random";
import { CARD_TIERS } from "./tiers";

const fixed = (value: number) => () => value;

describe("drop table", () => {
  it("adds up to 100 at every tier", () => {
    for (const tier of CARD_TIERS) {
      const total = DROP_KINDS.reduce((sum, k) => sum + CARD_DROP_WEIGHTS[tier][k], 0);
      expect(total, tier).toBe(100);
    }
  });

  it("never drops Skill cards at Bronze", () => {
    expect(CARD_DROP_WEIGHTS.Bronze.skill).toBe(0);
  });
});

describe("rollCard", () => {
  const base = { questType: "daily" as const, treats: {}, questlines: [] };

  it("matches the card tier to the quest rank", () => {
    const tiers = [1, 2, 3, 4, 5].map((rank) => rollCard({ ...base, rank, random: fixed(0) }).tier);
    expect(tiers).toEqual(["Bronze", "Silver", "Gold", "Platinum", "Diamond"]);
  });

  it("always drops exactly one card that can drop", () => {
    const random = seededRandom("drops");
    for (let i = 0; i < 500; i++) {
      const card = rollCard({ ...base, rank: 1 + (i % 5), random });
      expect(DROP_KINDS).toContain(card.kind);
      expect(["reward", "skill"]).not.toContain(card.kind);
    }
  });

  it("drops Reward cards only with a treat for the tier, and carries the treat", () => {
    const weights = dropWeights({ tier: "Silver", questType: "daily", hasTreat: false, questlinesLeft: 1 });
    expect(weights.reward).toBe(0);
    // A roll just under the end of the table lands on the last kinds.
    const random = seededRandom("reward");
    let rewards = 0;
    for (let i = 0; i < 300; i++) {
      const card = rollCard({ ...base, rank: 2, treats: { Silver: "Game night" }, random });
      if (card.kind === "reward") {
        rewards++;
        expect(card.treat).toBe("Game night");
      } else {
        expect(card.treat).toBeNull();
      }
    }
    expect(rewards).toBeGreaterThan(40);
  });

  it("drops Skill cards only when a questline is left, never from Skill quests", () => {
    expect(dropWeights({ tier: "Gold", questType: "daily", hasTreat: true, questlinesLeft: 0 }).skill).toBe(0);
    expect(dropWeights({ tier: "Gold", questType: "skill", hasTreat: true, questlinesLeft: 2 }).skill).toBe(0);
    expect(dropWeights({ tier: "Gold", questType: "main", hasTreat: true, questlinesLeft: 2 }).skill).toBe(18);
    // The very top of the roll is Skill when it can drop.
    const card = rollCard({ ...base, rank: 5, questlines: ["monk-breath"], random: fixed(0.999) });
    expect(card).toEqual({ kind: "skill", tier: "Diamond", treat: null, questlineId: "monk-breath" });
  });

  it("follows the weights", () => {
    const weights = CARD_DROP_WEIGHTS.Silver;
    expect(pickWeighted(weights, 0)).toBe("reroll");
    expect(pickWeighted(weights, 0.179)).toBe("reroll");
    expect(pickWeighted(weights, 0.18)).toBe("rest");
    expect(pickWeighted(weights, 0.999)).toBe("skill");
    expect(pickWeighted({ ...weights, skill: 0 }, 0.999)).toBe("reward");
  });

  it("is repeatable with the same seed", () => {
    const a = rollCard({ ...base, rank: 3, random: seededRandom("quest-1") });
    const b = rollCard({ ...base, rank: 3, random: seededRandom("quest-1") });
    expect(a).toEqual(b);
  });
});

describe("availableQuestlines", () => {
  it("offers the player's Class questlines not already on a card", () => {
    const cards = [
      { kind: "skill" as const, status: "used" as const, questlineId: "monk-breath" },
      { kind: "skill" as const, status: "discarded" as const, questlineId: "leader-speak" },
      { kind: "reroll" as const, status: "held" as const, questlineId: null },
    ];
    expect(availableQuestlines("monk", "leader", cards)).toEqual([
      "monk-winddown",
      "leader-speak",
      "leader-meeting",
    ]);
  });
});
