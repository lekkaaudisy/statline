// A failed main quest costs one held card or a small stat dent, never more.
// It costs nothing while sick or injured (the quest is excused) or when a
// Shield covered the day (the quest is shielded): those never reach here.
import type { Card } from "./cards";
import { MAIN_FAIL_STAT_DENT } from "./constants";
import { decayFloor } from "./decay";
import { handCards } from "./hand";
import type { StatState } from "./stat-state";
import { CARD_TIERS } from "./tiers";

export type MainPenalty =
  | { kind: "card"; cardId: string }
  | { kind: "dent"; newPoints: number };

// The card a failed main quest takes: the lowest tier, then the oldest.
// Never a Proof card, and only cards in the hand.
export function cardToLose(
  cards: readonly Pick<Card, "id" | "kind" | "status" | "tier" | "createdAt">[],
): string | null {
  const [first] = [...handCards(cards)].sort(
    (a, b) =>
      CARD_TIERS.indexOf(a.tier) - CARD_TIERS.indexOf(b.tier) ||
      a.createdAt.localeCompare(b.createdAt),
  );
  return first?.id ?? null;
}

// The stat's saved points after the dent: 5 points less, but never below
// the decay floor (best grade minus two steps). Already at or below the
// floor: no change.
export function dentedPoints(stat: Pick<StatState, "points" | "bestGrade">): number {
  const floor = decayFloor(stat.points, stat.bestGrade);
  return Math.max(Math.min(stat.points, floor), stat.points - MAIN_FAIL_STAT_DENT);
}

export function mainQuestPenalty(
  cards: readonly Pick<Card, "id" | "kind" | "status" | "tier" | "createdAt">[],
  stat: Pick<StatState, "points" | "bestGrade">,
): MainPenalty {
  const cardId = cardToLose(cards);
  if (cardId) return { kind: "card", cardId };
  return { kind: "dent", newPoints: dentedPoints(stat) };
}
