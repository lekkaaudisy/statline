// The MVP card catalogue: what each card is called, its family, what it
// does, and what the user can do with it.
//
// No card can ever be bought. Cards only come from quests, calibration,
// Awakening or the developer test tools, and nothing here has a price.
import { getQuestline } from "./skill-questlines";
import type { CardTier } from "./tiers";

export const CARD_KINDS = [
  "reroll",
  "rest",
  "double_xp",
  "shield",
  "reward",
  "skill",
  "day_one",
  "exclusive",
] as const;
export type CardKind = (typeof CARD_KINDS)[number];

// Cards that can drop from a cleared quest. Proof cards never drop.
export const DROP_KINDS = [
  "reroll",
  "rest",
  "double_xp",
  "shield",
  "reward",
  "skill",
] as const satisfies readonly CardKind[];
export type DropKind = (typeof DROP_KINDS)[number];

export type CardFamily = "system" | "reward" | "skill" | "proof";

// Where a card can come from. There is deliberately no "purchase".
export const CARD_SOURCES = ["quest", "calibration", "awakening", "dev"] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

// pending: dropped into a full hand, waiting for swap or discard.
// held: in the hand. active: in play (Double XP, Shield, an open questline).
// used: spent. discarded: thrown away. lost: taken by a failed main quest.
export type CardStatus = "pending" | "held" | "active" | "used" | "discarded" | "lost";

export const CARD_INFO: Record<
  CardKind,
  { family: CardFamily; name: string; effect: string; action: string | null }
> = {
  reroll: {
    family: "system",
    name: "Reroll",
    effect: "Swap one of today's daily or side quests for a different one.",
    action: "Use card",
  },
  rest: {
    family: "system",
    name: "Rest",
    effect: "Rest today: your open daily quests are rested, with no penalty.",
    action: "Use card",
  },
  double_xp: {
    family: "system",
    name: "Double XP",
    effect: "The next quest you clear gives double stat points.",
    action: "Use card",
  },
  shield: {
    family: "system",
    name: "Shield",
    effect: "Covers the next day you miss: no penalty for anything missed that day.",
    action: "Raise shield",
  },
  reward: {
    family: "reward",
    name: "Reward",
    effect: "Trade it for the treat you set for this tier.",
    action: "Redeem",
  },
  skill: {
    family: "skill",
    name: "Skill",
    effect: "Opens a short questline, one step a day.",
    action: "Open questline",
  },
  day_one: {
    family: "proof",
    name: "Day One",
    effect: "Proof you started. Kept forever.",
    action: null,
  },
  exclusive: {
    family: "proof",
    name: "Exclusive",
    effect: "Proof of your Awakening. Kept forever.",
    action: null,
  },
};

export const FAMILY_NAME: Record<CardFamily, string> = {
  system: "System",
  reward: "Reward",
  skill: "Skill",
  proof: "Proof",
};

export type Card = {
  id: string;
  kind: CardKind;
  tier: CardTier;
  status: CardStatus;
  // Reward cards: the treat, as set when the card dropped.
  treat: string | null;
  // Skill cards: the questline, its length, and the steps cleared so far.
  questlineId: string | null;
  questlineLength: number | null;
  questlineStep: number;
  // The day an active card went into play.
  activatedOn: string | null;
  createdAt: string;
};

export function familyOf(kind: CardKind): CardFamily {
  return CARD_INFO[kind].family;
}

export function isProofCard(card: { kind: CardKind }): boolean {
  return familyOf(card.kind) === "proof";
}

// Proof cards can never be used, traded or discarded.
export function canUseCard(card: { kind: CardKind; status: CardStatus }): boolean {
  return card.status === "held" && !isProofCard(card);
}

export function canDiscardCard(card: { kind: CardKind; status: CardStatus }): boolean {
  return (card.status === "held" || card.status === "pending") && !isProofCard(card);
}

export function cardName(card: Pick<Card, "kind" | "treat" | "questlineId">): string {
  if (card.kind === "reward" && card.treat) return card.treat;
  if (card.kind === "skill" && card.questlineId) {
    return getQuestline(card.questlineId)?.name ?? CARD_INFO.skill.name;
  }
  return CARD_INFO[card.kind].name;
}

export function cardEffect(card: Pick<Card, "kind" | "treat" | "questlineId">): string {
  if (card.kind === "skill" && card.questlineId) {
    const questline = getQuestline(card.questlineId);
    if (questline) return `${questline.summary} ${questline.steps.length} steps, one a day.`;
  }
  return CARD_INFO[card.kind].effect;
}
