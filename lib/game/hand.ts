// The hand: at most 10 cards. When a card drops into a full hand, it waits
// until the user swaps it for a held card or discards it. Proof cards sit
// apart from the hand: they never count toward the limit and can never be
// used, traded or discarded.
import { isProofCard, type Card } from "./cards";
import { HAND_SIZE } from "./constants";

type HandCard = Pick<Card, "id" | "kind" | "status">;

// Cards that take up a hand slot: held, and not Proof cards.
export function handCards<T extends HandCard>(cards: readonly T[]): T[] {
  return cards.filter((c) => c.status === "held" && !isProofCard(c));
}

export function handCount(cards: readonly HandCard[]): number {
  return handCards(cards).length;
}

export function handIsFull(cards: readonly HandCard[]): boolean {
  return handCount(cards) >= HAND_SIZE;
}

// Where a newly dropped card goes: into the hand, or waiting if it is full.
// Proof cards always go straight in.
export function placeNewCard(
  cards: readonly HandCard[],
  newCard: Pick<Card, "kind">,
): "held" | "pending" {
  if (isProofCard(newCard)) return "held";
  return handIsFull(cards) ? "pending" : "held";
}

export type PendingChoice = { keep: false } | { keep: true; swapOut: string | null };

// Checks the user's choice for a waiting card. Keeping it needs a free slot,
// or a held card to swap out (never a Proof card). Returns an error message,
// or null when the choice is fine.
export function pendingChoiceError(
  cards: readonly HandCard[],
  pendingId: string,
  choice: PendingChoice,
): string | null {
  const pending = cards.find((c) => c.id === pendingId);
  if (!pending || pending.status !== "pending") return "That card is no longer waiting.";
  if (!choice.keep) return null;

  if (choice.swapOut === null) {
    return handIsFull(cards) ? "Your hand is full. Choose a card to swap out." : null;
  }
  const out = cards.find((c) => c.id === choice.swapOut);
  if (!out || out.status !== "held") return "Choose a card from your hand to swap out.";
  if (isProofCard(out)) return "Proof cards can't be swapped out.";
  return null;
}
