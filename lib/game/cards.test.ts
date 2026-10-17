import { describe, expect, it } from "vitest";
import {
  CARD_INFO,
  CARD_KINDS,
  CARD_SOURCES,
  canDiscardCard,
  canUseCard,
  cardEffect,
  cardName,
  DROP_KINDS,
  familyOf,
  isProofCard,
} from "./cards";

describe("card catalogue", () => {
  it("has the MVP families", () => {
    expect(CARD_KINDS.map(familyOf)).toEqual([
      "system", "system", "system", "system", "reward", "skill", "proof", "proof",
    ]);
  });

  it("never drops Proof cards from quests", () => {
    expect(DROP_KINDS.some((k) => familyOf(k) === "proof")).toBe(false);
  });

  it("can never be bought", () => {
    expect(CARD_SOURCES).not.toContain("purchase");
    expect(CARD_SOURCES).not.toContain("shop");
    for (const info of Object.values(CARD_INFO)) {
      expect(Object.keys(info)).not.toContain("price");
      expect(Object.keys(info)).not.toContain("cost");
      expect(JSON.stringify(info)).not.toMatch(/\b(buy|purchase|price)\b/i);
    }
  });

  it("gives Proof cards no action", () => {
    expect(CARD_INFO.day_one.action).toBeNull();
    expect(CARD_INFO.exclusive.action).toBeNull();
  });
});

describe("what can be done with a card", () => {
  it("never uses or discards Proof cards", () => {
    const proof = { kind: "day_one" as const, status: "held" as const };
    expect(isProofCard(proof)).toBe(true);
    expect(canUseCard(proof)).toBe(false);
    expect(canDiscardCard(proof)).toBe(false);
  });

  it("uses only held cards", () => {
    expect(canUseCard({ kind: "reroll", status: "held" })).toBe(true);
    expect(canUseCard({ kind: "reroll", status: "pending" })).toBe(false);
    expect(canUseCard({ kind: "shield", status: "active" })).toBe(false);
    expect(canUseCard({ kind: "rest", status: "used" })).toBe(false);
  });

  it("discards held or waiting cards", () => {
    expect(canDiscardCard({ kind: "reward", status: "held" })).toBe(true);
    expect(canDiscardCard({ kind: "reward", status: "pending" })).toBe(true);
    expect(canDiscardCard({ kind: "reward", status: "used" })).toBe(false);
  });
});

describe("card names", () => {
  it("names Reward cards after the treat", () => {
    expect(cardName({ kind: "reward", treat: "Game night", questlineId: null })).toBe("Game night");
  });

  it("names Skill cards after the questline", () => {
    const card = { kind: "skill" as const, treat: null, questlineId: "monk-breath" };
    expect(cardName(card)).toBe("Breath and Stillness");
    expect(cardEffect(card)).toContain("7 steps");
  });

  it("uses the catalogue name otherwise", () => {
    expect(cardName({ kind: "double_xp", treat: null, questlineId: null })).toBe("Double XP");
  });
});
