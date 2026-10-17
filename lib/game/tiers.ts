// Card tier = quest difficulty rank. Cards themselves arrive in Slice 5;
// quests already show the tier they will pay out.

export const CARD_TIERS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Challenger",
] as const;
export type CardTier = (typeof CARD_TIERS)[number];

export function tierForRank(rank: number): CardTier {
  const index = Math.min(CARD_TIERS.length, Math.max(1, Math.round(rank))) - 1;
  return CARD_TIERS[index];
}
