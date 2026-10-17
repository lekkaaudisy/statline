"use server";

import { refresh } from "next/cache";
import {
  cardUsedMessage,
  cardUseError,
  rerollQuest,
  rerollTargets,
} from "@/lib/game/card-effects";
import { isClassId } from "@/lib/game/classes";
import { toIsoDate } from "@/lib/game/dates";
import { applyDecay } from "@/lib/game/decay";
import { pendingChoiceError } from "@/lib/game/hand";
import type { DailyMinutes } from "@/lib/game/quests";
import { seededRandom } from "@/lib/game/random";
import { isRestDay } from "@/lib/game/rest-day";
import { getQuestline } from "@/lib/game/skill-questlines";
import { EARNED_STATS, type EarnedStat } from "@/lib/game/stats";
import { availableQuestlines } from "@/lib/game/card-drops";
import { devToolsFlagOn } from "@/lib/dev-tools";
import { loadCards } from "@/lib/supabase/cards";
import { loadStats } from "@/lib/supabase/player";
import { loadRestDays, QUEST_COLUMNS, toQuest } from "@/lib/supabase/quests";
import { createClient } from "@/lib/supabase/server";

const SAVE_FAILED = "The System could not save that. Try again.";

function friendly(error: { code?: string; message: string }): string {
  return error.code === "P0001" ? error.message : SAVE_FAILED;
}

export type CardActionResult = { error?: string; message?: string };

// Uses a held card. A Reroll also needs the quest to swap.
export async function playCard(input: unknown): Promise<CardActionResult> {
  if (typeof input !== "object" || input === null) return { error: SAVE_FAILED };
  const { cardId, questId } = input as Record<string, unknown>;
  if (typeof cardId !== "string") return { error: SAVE_FAILED };

  const supabase = await createClient();
  const today = toIsoDate(new Date());
  const [cards, { data: questRows }, rest] = await Promise.all([
    loadCards(supabase),
    supabase.from("quests").select(QUEST_COLUMNS).gte("due_on", today).lte("issued_on", today),
    loadRestDays(supabase, today),
  ]);
  const card = cards.find((c) => c.id === cardId);
  if (!card) return { error: "That card is not in your hand." };
  const quests = (questRows ?? []).map(toQuest);

  const problem = cardUseError(card, {
    today,
    quests,
    cards,
    restToday: isRestDay(rest.all, today),
  });
  if (problem) return { error: problem };

  let result;
  switch (card.kind) {
    case "reroll": {
      const target = rerollTargets(quests, today).find((q) => q.id === questId);
      if (!target) return { error: "Choose one of today's open daily or side quests." };
      const [{ data: profile }, { earned }] = await Promise.all([
        supabase
          .from("profiles")
          .select("main_class, second_class, goal, daily_minutes, difficulty_rank, sick_since")
          .maybeSingle(),
        loadStats(supabase),
      ]);
      if (!profile || !isClassId(profile.main_class)) return { error: SAVE_FAILED };
      const points = Object.fromEntries(
        EARNED_STATS.map((s) => [s, applyDecay({ ...earned[s], today, sickSince: profile.sick_since })]),
      ) as Record<EarnedStat, number>;
      const next = rerollQuest({
        target,
        todayQuests: quests.filter((q) => q.issuedOn === today),
        player: {
          mainClass: profile.main_class,
          secondClass: isClassId(profile.second_class) ? profile.second_class : null,
          goal: profile.goal ?? "",
          dailyMinutes: profile.daily_minutes as DailyMinutes,
          rank: profile.difficulty_rank,
          points,
        },
        random: seededRandom(`reroll:${card.id}`),
      });
      if (!next) return { error: "There is no other quest to swap in today." };
      result = await supabase.rpc("use_reroll", {
        p_card_id: card.id,
        p_quest_id: target.id,
        p_new: {
          template_id: next.templateId,
          title: next.title,
          stat: next.stat,
          minutes: next.minutes,
        },
      });
      break;
    }
    case "rest":
      result = await supabase.rpc("use_rest", { p_card_id: card.id });
      break;
    case "double_xp":
    case "shield":
      result = await supabase.rpc("activate_card", { p_card_id: card.id });
      break;
    case "reward":
      result = await supabase.rpc("redeem_reward", { p_card_id: card.id });
      break;
    case "skill": {
      const questline = getQuestline(card.questlineId ?? "");
      if (!questline) return { error: "This questline no longer exists." };
      result = await supabase.rpc("open_questline", {
        p_card_id: card.id,
        p_length: questline.steps.length,
      });
      break;
    }
    default:
      return { error: "This card can't be used." };
  }
  if (result.error) return { error: friendly(result.error) };
  refresh();
  return { message: cardUsedMessage(card) };
}

// Keeps a card that dropped into a full hand (swapping out a held card), or
// discards it.
export async function resolvePendingCard(input: unknown): Promise<CardActionResult> {
  if (typeof input !== "object" || input === null) return { error: SAVE_FAILED };
  const { cardId, keep, swapOut } = input as Record<string, unknown>;
  if (typeof cardId !== "string" || typeof keep !== "boolean") return { error: SAVE_FAILED };
  const out = typeof swapOut === "string" ? swapOut : null;

  const supabase = await createClient();
  const cards = await loadCards(supabase);
  const problem = pendingChoiceError(cards, cardId, keep ? { keep, swapOut: out } : { keep });
  if (problem) return { error: problem };

  const { error } = await supabase.rpc("resolve_pending_card", {
    p_card_id: cardId,
    p_keep: keep,
    p_swap_out: keep ? out : null,
  });
  if (error) return { error: friendly(error) };
  refresh();
  return { message: keep ? "Card added to your hand." : "Card discarded." };
}

// Throws away a held card. Proof cards are refused.
export async function discardCard(cardId: unknown): Promise<CardActionResult> {
  if (typeof cardId !== "string") return { error: SAVE_FAILED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_card", { p_card_id: cardId });
  if (error) return { error: friendly(error) };
  refresh();
  return { message: "Card discarded." };
}

// Developer-only: one Silver card of each kind, for testing every effect.
export async function devGiveCards(): Promise<CardActionResult> {
  if (!devToolsFlagOn()) return { error: "Developer tools are off." };
  const supabase = await createClient();
  const [{ data: profile }, cards] = await Promise.all([
    supabase.from("profiles").select("main_class, second_class").maybeSingle(),
    loadCards(supabase),
  ]);
  if (!profile || !isClassId(profile.main_class)) return { error: SAVE_FAILED };
  const [questline] = availableQuestlines(
    profile.main_class,
    isClassId(profile.second_class) ? profile.second_class : null,
    cards,
  );
  const { error } = await supabase.rpc("dev_give_cards", { p_questline_id: questline ?? null });
  if (error) return { error: error.message };
  refresh();
  return { message: "Test cards added." };
}
