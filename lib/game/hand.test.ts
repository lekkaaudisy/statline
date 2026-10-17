import { describe, expect, it } from "vitest";
import type { CardKind, CardStatus } from "./cards";
import { HAND_SIZE } from "./constants";
import { handCount, handIsFull, pendingChoiceError, placeNewCard } from "./hand";

function card(id: string, kind: CardKind = "reroll", status: CardStatus = "held") {
  return { id, kind, status };
}

function fullHand() {
  return Array.from({ length: HAND_SIZE }, (_, i) => card(`c${i}`));
}

describe("hand limit", () => {
  it("holds at most 10 cards", () => {
    expect(HAND_SIZE).toBe(10);
    expect(handIsFull(fullHand().slice(1))).toBe(false);
    expect(handIsFull(fullHand())).toBe(true);
  });

  it("counts only held cards, never Proof cards", () => {
    const cards = [
      card("a"),
      card("b", "shield", "active"),
      card("c", "rest", "used"),
      card("d", "rest", "pending"),
      card("e", "day_one"),
      card("f", "exclusive"),
    ];
    expect(handCount(cards)).toBe(1);
  });

  it("does not fill up with Proof cards", () => {
    const cards = [...fullHand().slice(1), card("p", "day_one")];
    expect(handIsFull(cards)).toBe(false);
  });

  it("puts a new card in the hand, or waiting when full", () => {
    expect(placeNewCard([], { kind: "rest" })).toBe("held");
    expect(placeNewCard(fullHand(), { kind: "rest" })).toBe("pending");
    expect(placeNewCard(fullHand(), { kind: "day_one" })).toBe("held");
  });
});

describe("choosing for a waiting card", () => {
  const cards = [...fullHand(), card("new", "shield", "pending"), card("proof", "day_one")];

  it("can always discard the new card", () => {
    expect(pendingChoiceError(cards, "new", { keep: false })).toBeNull();
  });

  it("needs a swap while the hand is full", () => {
    expect(pendingChoiceError(cards, "new", { keep: true, swapOut: null })).toMatch(/full/);
    expect(pendingChoiceError(cards, "new", { keep: true, swapOut: "c3" })).toBeNull();
  });

  it("keeps it without a swap once there is room", () => {
    const room = cards.filter((c) => c.id !== "c0");
    expect(pendingChoiceError(room, "new", { keep: true, swapOut: null })).toBeNull();
  });

  it("never swaps out a Proof card", () => {
    expect(pendingChoiceError(cards, "new", { keep: true, swapOut: "proof" })).toMatch(/Proof/);
  });

  it("refuses cards that are not waiting or not held", () => {
    expect(pendingChoiceError(cards, "c1", { keep: false })).not.toBeNull();
    expect(pendingChoiceError(cards, "new", { keep: true, swapOut: "missing" })).not.toBeNull();
  });
});
