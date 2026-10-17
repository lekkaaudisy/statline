// What each MVP card does when used, and when it can be used.
//
// - Reroll: swaps one of today's open daily or System side quests for a
//   different quest of the same type, rank and slot.
// - Rest: today's open daily quests are rested, with no penalty.
// - Double XP: the next cleared quest gives double points.
// - Shield: covers the first day from today with a missed daily or main
//   quest. Everything missed that day is shielded, with no penalty.
// - Reward: redeems the treat the user set for the card's tier.
// - Skill: opens a questline. One step is given per day.
import { canUseCard, type Card } from "./cards";
import {
  DAILY_QUESTS_BY_MINUTES,
  DOUBLE_XP_MULTIPLIER,
  MAX_OPEN_QUESTLINES,
  SKILL_STEP_DAYS,
  STRENGTH_DAILIES_PER_DAY,
} from "./constants";
import { addDays } from "./dates";
import { effortMinutes, questGain, type QuestType } from "./difficulty";
import { allowedProofs, type SelectableProof } from "./proof";
import {
  BALANCE_TEMPLATES,
  CLASS_TEMPLATES,
  fillTitle,
  usesMinutes,
  type QuestTemplate,
} from "./quest-templates";
import type { Player, QuestDraft } from "./quests";
import { pick, type Random } from "./random";
import { getQuestline, stepTemplateId } from "./skill-questlines";
import type { EarnedStat } from "./stats";

// A saved quest, as far as card effects need to know.
export type EffectQuest = {
  id: string;
  type: QuestType;
  source: "system" | "user";
  status: string;
  templateId: string | null;
  stat: EarnedStat;
  rank: number;
  countsForClass: boolean;
  issuedOn: string;
  dueOn: string;
  slot: number | null;
  cardId: string | null;
};

type EffectCard = Pick<
  Card,
  "id" | "kind" | "status" | "questlineId" | "questlineLength" | "questlineStep" | "activatedOn"
>;

// --- Using a card ------------------------------------------------------------

// Quests a Reroll can swap: today's open daily and System side quests.
export function rerollTargets<T extends EffectQuest>(quests: readonly T[], today: string): T[] {
  return quests.filter(
    (q) =>
      q.source === "system" &&
      (q.type === "daily" || q.type === "side") &&
      q.status === "open" &&
      q.issuedOn === today,
  );
}

// Today's open daily quests, which a Rest card would rest.
export function restTargets<T extends EffectQuest>(quests: readonly T[], today: string): T[] {
  return quests.filter((q) => q.type === "daily" && q.status === "open" && q.issuedOn === today);
}

export function openQuestlineCount(cards: readonly EffectCard[]): number {
  return cards.filter((c) => c.kind === "skill" && c.status === "active").length;
}

// Whether a held card can be used right now. Returns an error message for
// the user, or null when it can.
export function cardUseError(
  card: EffectCard,
  context: {
    today: string;
    quests: readonly EffectQuest[];
    cards: readonly EffectCard[];
    restToday: boolean;
  },
): string | null {
  if (!canUseCard(card)) {
    return card.kind === "day_one" || card.kind === "exclusive"
      ? "Proof cards are kept, never used."
      : "This card is not in your hand.";
  }
  const { today, quests, cards, restToday } = context;
  const active = (kind: Card["kind"]) =>
    cards.some((c) => c.kind === kind && c.status === "active");

  switch (card.kind) {
    case "reroll":
      return rerollTargets(quests, today).length > 0
        ? null
        : "No open daily or side quest to swap today.";
    case "rest":
      if (restToday) return "Today is already a rest day.";
      return restTargets(quests, today).length > 0 ? null : "No open daily quests to rest today.";
    case "double_xp":
      return active("double_xp") ? "Double XP is already active. Clear a quest first." : null;
    case "shield":
      return active("shield") ? "A shield is already up." : null;
    case "reward":
      return null;
    case "skill": {
      const questline = card.questlineId ? getQuestline(card.questlineId) : undefined;
      if (!questline) return "This questline no longer exists.";
      if (openQuestlineCount(cards) >= MAX_OPEN_QUESTLINES) {
        return `You can have ${MAX_OPEN_QUESTLINES} questlines open at once. Finish one first.`;
      }
      return null;
    }
    default:
      return "This card can't be used.";
  }
}

// --- Reroll ------------------------------------------------------------------

// The quest a Reroll swaps in: same type, rank, slot and day, from the same
// pool (Class or balance) so the 60/40 rule holds. It prefers the same stat,
// never repeats a quest already given today, and keeps the one-strength-
// quest-a-day cap. Null when nothing else fits.
export function rerollQuest(input: {
  target: EffectQuest;
  todayQuests: readonly EffectQuest[];
  player: Player;
  random: Random;
}): QuestDraft | null {
  const { target, todayQuests, player, random } = input;
  if (target.type !== "daily" && target.type !== "side") return null;

  const usedToday = new Set(todayQuests.flatMap((q) => (q.templateId ? [q.templateId] : [])));
  const strengthFull =
    todayQuests.filter(
      (q) =>
        q.id !== target.id && q.type !== "main" && q.status !== "rerolled" && q.stat === "strength",
    ).length >= STRENGTH_DAILIES_PER_DAY;

  const pool: readonly QuestTemplate[] = target.countsForClass
    ? [
        ...CLASS_TEMPLATES[player.mainClass],
        ...(player.secondClass ? CLASS_TEMPLATES[player.secondClass] : []),
      ]
    : BALANCE_TEMPLATES;
  const fits = pool.filter(
    (t) => !usedToday.has(t.id) && !(strengthFull && t.stat === "strength"),
  );
  if (fits.length === 0) return null;
  const sameStat = fits.filter((t) => t.stat === target.stat);
  const template = pick(sameStat.length > 0 ? sameStat : fits, random);

  const available = player.dailyMinutes / DAILY_QUESTS_BY_MINUTES[player.dailyMinutes];
  const minutes = usesMinutes(template)
    ? effortMinutes(available, target.rank, template.stat, player.dailyMinutes)
    : null;
  return {
    type: target.type,
    templateId: template.id,
    title: fillTitle(template.title, { minutes: minutes ?? undefined }),
    stat: template.stat,
    rank: target.rank,
    gain: questGain(target.rank, target.type),
    minutes,
    countsForClass: target.countsForClass,
    allowedProofs: allowedProofs(target.rank),
    issuedOn: target.issuedOn,
    dueOn: target.dueOn,
    slot: target.slot ?? 1,
  };
}

// --- Double XP ---------------------------------------------------------------

// Points for a cleared quest, doubled while Double XP is active.
export function withDoubleXp(points: number, doubleActive: boolean): number {
  return doubleActive ? points * DOUBLE_XP_MULTIPLIER : points;
}

// --- Shield ------------------------------------------------------------------

// The day an active Shield covers: the earliest day, from the day it was
// raised, with a missed daily or main quest that has not been penalised.
// Optional side quests and Skill steps never use up a Shield. Null when
// nothing has been missed yet.
export function shieldDay(
  activatedOn: string,
  quests: readonly (Pick<EffectQuest, "type" | "status" | "dueOn"> & { penalty: string | null })[],
): string | null {
  const days = quests
    .filter(
      (q) =>
        (q.type === "daily" || q.type === "main") &&
        q.status === "missed" &&
        q.penalty === null &&
        q.dueOn >= activatedOn,
    )
    .map((q) => q.dueOn)
    .sort();
  return days[0] ?? null;
}

// --- Skill questlines ----------------------------------------------------------

export type SkillStepDraft = {
  type: "skill";
  cardId: string;
  templateId: string;
  title: string;
  stat: EarnedStat;
  rank: number;
  gain: number;
  minutes: null;
  countsForClass: true;
  allowedProofs: SelectableProof[];
  issuedOn: string;
  dueOn: string;
  slot: number;
};

// The next steps owed today, one per open questline. A questline gets its
// next step when it has no step still open and none was given today. A step
// that ran out without being cleared is given again. Each open questline
// takes one of the slots 1 to 3 for the day. Strength safety: a strength
// step waits for a day with no other strength quest (daily, side or step).
export function nextSkillSteps(
  cards: readonly EffectCard[],
  quests: readonly EffectQuest[],
  today: string,
): SkillStepDraft[] {
  const skillQuests = quests.filter((q) => q.type === "skill");
  const takenSlots = new Set(
    skillQuests.filter((q) => q.issuedOn === today).map((q) => q.slot),
  );
  const drafts: SkillStepDraft[] = [];
  let strengthToday =
    quests.filter(
      (q) => q.issuedOn === today && q.type !== "main" && q.status !== "rerolled" && q.stat === "strength",
    ).length;

  for (const card of cards) {
    if (card.kind !== "skill" || card.status !== "active" || !card.questlineId) continue;
    const questline = getQuestline(card.questlineId);
    if (!questline || card.questlineStep >= questline.steps.length) continue;
    const mine = skillQuests.filter((q) => q.cardId === card.id);
    const stillOpen = mine.some((q) => q.status === "open" && q.dueOn >= today);
    const givenToday = mine.some((q) => q.issuedOn === today);
    if (stillOpen || givenToday) continue;

    const stepNumber = card.questlineStep + 1;
    const step = questline.steps[stepNumber - 1];
    if (step.stat === "strength" && strengthToday >= STRENGTH_DAILIES_PER_DAY) continue;

    const slot = [1, 2, 3].find((s) => !takenSlots.has(s));
    if (slot === undefined) break;
    takenSlots.add(slot);
    if (step.stat === "strength") strengthToday += 1;
    drafts.push({
      type: "skill",
      cardId: card.id,
      templateId: stepTemplateId(questline.id, stepNumber),
      title: step.title,
      stat: step.stat,
      rank: step.rank,
      gain: questGain(step.rank, "skill"),
      minutes: null,
      countsForClass: true,
      allowedProofs: allowedProofs(step.rank),
      issuedOn: today,
      dueOn: addDays(today, SKILL_STEP_DAYS - 1),
      slot,
    });
  }
  return drafts;
}

// "Step 2 of 6", for the hand screen.
export function questlineProgress(card: EffectCard): { step: number; total: number } | null {
  const questline = card.questlineId ? getQuestline(card.questlineId) : undefined;
  if (!questline) return null;
  return { step: card.questlineStep, total: questline.steps.length };
}

// --- After use ----------------------------------------------------------------

// The System's message once a card is used. Reward cards name the treat.
export function cardUsedMessage(card: Pick<Card, "kind" | "treat" | "questlineId">): string {
  switch (card.kind) {
    case "reroll":
      return "Reroll used: the quest was swapped.";
    case "rest":
      return "Rest card used: today's daily quests are rested, with no penalty.";
    case "double_xp":
      return "Double XP is active: your next quest counts twice.";
    case "shield":
      return "Shield raised: the next day you miss has no penalty.";
    case "reward":
      return `Reward redeemed: ${card.treat ?? "your treat"}. Enjoy it. You earned it.`;
    case "skill": {
      const name = card.questlineId ? getQuestline(card.questlineId)?.name : undefined;
      return `Questline opened: ${name ?? "your questline"}. Its first step is on your quest list.`;
    }
    default:
      return "Card used.";
  }
}
