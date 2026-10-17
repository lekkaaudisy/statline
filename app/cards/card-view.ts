import { CARD_INFO, cardEffect, cardName, familyOf, FAMILY_NAME, type Card } from "@/lib/game/cards";
import type { CardTier } from "@/lib/game/tiers";

// A card ready to show: plain data, safe to pass from the server to the phone.
export type CardView = {
  id: string;
  kind: Card["kind"];
  tier: CardTier;
  family: string;
  name: string;
  effect: string;
  action: string | null;
  status: Card["status"];
};

export function cardView(
  card: Pick<Card, "id" | "kind" | "tier" | "status" | "treat" | "questlineId">,
): CardView {
  return {
    id: card.id,
    kind: card.kind,
    tier: card.tier,
    family: FAMILY_NAME[familyOf(card.kind)],
    name: cardName(card),
    effect: cardEffect(card),
    action: CARD_INFO[card.kind].action,
    status: card.status,
  };
}
