import { describe, expect, it } from "vitest";
import type { CardKind, CardStatus } from "./cards";
import { MAIN_FAIL_STAT_DENT } from "./constants";
import { cardToLose, dentedPoints, mainQuestPenalty } from "./main-penalty";
import type { CardTier } from "./tiers";

function card(
  id: string,
  tier: CardTier,
  createdAt: string,
  kind: CardKind = "reroll",
  status: CardStatus = "held",
) {
  return { id, kind, tier, status, createdAt };
}

describe("failed main quest penalty", () => {
  it("takes one held card: lowest tier first, then the oldest", () => {
    const cards = [
      card("gold", "Gold", "2026-10-01"),
      card("silver-new", "Silver", "2026-10-05"),
      card("silver-old", "Silver", "2026-10-02"),
    ];
    expect(cardToLose(cards)).toBe("silver-old");
    expect(mainQuestPenalty(cards, { points: 100, bestGrade: "C" })).toEqual({
      kind: "card",
      cardId: "silver-old",
    });
  });

  it("never takes Proof, waiting, active or used cards", () => {
    const cards = [
      card("proof", "Bronze", "2026-10-01", "day_one"),
      card("wait", "Bronze", "2026-10-01", "rest", "pending"),
      card("shield", "Bronze", "2026-10-01", "shield", "active"),
      card("used", "Bronze", "2026-10-01", "rest", "used"),
    ];
    expect(cardToLose(cards)).toBeNull();
  });

  it("dents the stat by 5 points when there is no card to lose", () => {
    expect(MAIN_FAIL_STAT_DENT).toBe(5);
    expect(mainQuestPenalty([], { points: 100, bestGrade: "C" })).toEqual({
      kind: "dent",
      newPoints: 95,
    });
  });

  it("never dents below the decay floor", () => {
    // Best grade B (110): the floor is D (45).
    expect(dentedPoints({ points: 47, bestGrade: "B" })).toBe(45);
    expect(dentedPoints({ points: 45, bestGrade: "B" })).toBe(45);
    expect(dentedPoints({ points: 40, bestGrade: "B" })).toBe(40);
  });

  it("never goes below zero", () => {
    expect(dentedPoints({ points: 3, bestGrade: null })).toBe(0);
  });
});
