// Card drops: every cleared quest pays out one card whose tier matches the
// quest's difficulty rank.
import { DROP_KINDS, type Card, type DropKind } from "./cards";
import type { ClassId } from "./classes";
import { CARD_DROP_WEIGHTS } from "./constants";
import type { QuestType } from "./difficulty";
import type { Random } from "./random";
import { questlinesForClasses } from "./skill-questlines";
import { tierForRank, type CardTier } from "./tiers";

export type CardDrop = {
  kind: DropKind;
  tier: CardTier;
  // Reward cards: the treat set for this tier.
  treat: string | null;
  // Skill cards: the questline it opens.
  questlineId: string | null;
};

// Questlines a new Skill card may open: from the player's Classes, and not
// already on a card they have (waiting, held, open or finished).
export function availableQuestlines(
  mainClass: ClassId,
  secondClass: ClassId | null,
  cards: readonly Pick<Card, "kind" | "status" | "questlineId">[],
): string[] {
  const taken = new Set(
    cards
      .filter((c) => c.kind === "skill" && c.status !== "discarded" && c.status !== "lost")
      .map((c) => c.questlineId),
  );
  return questlinesForClasses(mainClass, secondClass)
    .map((q) => q.id)
    .filter((id) => !taken.has(id));
}

// The drop chances for one quest. Reward needs a treat for the tier, Skill
// needs a questline left to open, and Skill quests never drop Skill cards.
// Anything that cannot drop gets a weight of 0.
export function dropWeights(input: {
  tier: CardTier;
  questType: QuestType;
  hasTreat: boolean;
  questlinesLeft: number;
}): Record<DropKind, number> {
  const weights = { ...CARD_DROP_WEIGHTS[input.tier] };
  if (!input.hasTreat) weights.reward = 0;
  if (input.questType === "skill" || input.questlinesLeft === 0) weights.skill = 0;
  return weights;
}

// Picks one kind with the given weights. `roll` is 0 (inclusive) to 1.
export function pickWeighted(weights: Record<DropKind, number>, roll: number): DropKind {
  const total = DROP_KINDS.reduce((sum, kind) => sum + weights[kind], 0);
  let point = roll * total;
  for (const kind of DROP_KINDS) {
    if (weights[kind] <= 0) continue;
    if (point < weights[kind]) return kind;
    point -= weights[kind];
  }
  // Only reached through rounding: the last kind that can drop.
  return [...DROP_KINDS].reverse().find((kind) => weights[kind] > 0) ?? "reroll";
}

// The card a cleared quest pays out.
export function rollCard(input: {
  rank: number;
  questType: QuestType;
  treats: Partial<Record<CardTier, string>>;
  questlines: readonly string[];
  random: Random;
}): CardDrop {
  const tier = tierForRank(input.rank);
  const treat = input.treats[tier] ?? null;
  const weights = dropWeights({
    tier,
    questType: input.questType,
    hasTreat: Boolean(treat),
    questlinesLeft: input.questlines.length,
  });
  const kind = pickWeighted(weights, input.random());
  return {
    kind,
    tier,
    treat: kind === "reward" ? treat : null,
    questlineId:
      kind === "skill"
        ? input.questlines[Math.floor(input.random() * input.questlines.length)]
        : null,
  };
}
