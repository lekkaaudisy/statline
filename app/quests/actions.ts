"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { availableQuestlines, rollCard } from "@/lib/game/card-drops";
import { withDoubleXp } from "@/lib/game/card-effects";
import { isClassId } from "@/lib/game/classes";
import { toIsoDate } from "@/lib/game/dates";
import { applyDecay } from "@/lib/game/decay";
import { pointsToGrade } from "@/lib/game/grades";
import { isSelectableProof, proofError, proofPoints } from "@/lib/game/proof";
import { canCreateSideQuest, validateSideQuest } from "@/lib/game/quests";
import { handCards } from "@/lib/game/hand";
import { seededRandom } from "@/lib/game/random";
import { canTakeRestDay, isRestDay } from "@/lib/game/rest-day";
import { addPoints } from "@/lib/game/stat-state";
import type { EarnedStat, Grade } from "@/lib/game/stats";
import { loadCards, loadTreats } from "@/lib/supabase/cards";
import { loadStats } from "@/lib/supabase/player";
import {
  currentUserId,
  loadRestDays,
  QUEST_COLUMNS,
  saveRestDay,
  toQuest,
} from "@/lib/supabase/quests";
import { cardView, type CardView } from "../cards/card-view";
import { createClient } from "@/lib/supabase/server";

const SAVE_FAILED = "The System could not save that. Try again.";

// Database refusals (raised by our own functions) are written for players,
// so they can be shown as they are. Anything else gets a general message.
function friendly(error: { code?: string; message: string }): string {
  return error.code === "P0001" ? error.message : SAVE_FAILED;
}

export type CompleteResult =
  | {
      ok: true;
      awarded: number;
      stat: EarnedStat;
      before: Grade;
      after: Grade;
      double: boolean;
      // The card the quest paid out. "pending" means the hand was full:
      // `hand` then holds the cards it could be swapped for.
      card: CardView;
      hand: CardView[];
    }
  | { ok: false; error: string };

// Completes a quest with proof and pays out one card. Photos are uploaded
// from the phone first, so this only receives the photo's path.
export async function completeQuest(input: unknown): Promise<CompleteResult> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: SAVE_FAILED };
  }
  const { questId, proof, summary, photoPath } = input as Record<string, unknown>;
  if (typeof questId !== "string" || !isSelectableProof(proof)) {
    return { ok: false, error: SAVE_FAILED };
  }
  const cleanSummary =
    typeof summary === "string" && summary.trim() ? summary.trim() : null;
  const cleanPhoto = typeof photoPath === "string" && photoPath ? photoPath : null;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return { ok: false, error: "Log in again to continue." };

  const { data: row } = await supabase
    .from("quests")
    .select(QUEST_COLUMNS)
    .eq("id", questId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Quest not found." };
  const quest = toQuest(row);
  const today = toIsoDate(new Date());
  if (quest.status !== "open" || quest.dueOn < today) {
    return { ok: false, error: "This quest is no longer open." };
  }

  const submission = { proof, summary: cleanSummary, photoPath: cleanPhoto };
  const problem = proofError(submission, quest, userId);
  if (problem) return { ok: false, error: problem };

  const [{ earned }, { data: profile }, cards, treats] = await Promise.all([
    loadStats(supabase),
    supabase.from("profiles").select("sick_since, main_class, second_class").maybeSingle(),
    loadCards(supabase),
    loadTreats(supabase),
  ]);
  if (!profile || !isClassId(profile.main_class)) return { ok: false, error: SAVE_FAILED };
  const sickSince: string | null = profile.sick_since ?? null;
  const stat = earned[quest.stat];
  const double = cards.some((c) => c.kind === "double_xp" && c.status === "active");
  const awarded = withDoubleXp(proofPoints(quest.gain, proof), double);
  const before = pointsToGrade(applyDecay({ ...stat, today, sickSince }));
  const next = addPoints(stat, awarded, today, sickSince);

  // The same quest always rolls the same card, so a retry cannot reroll it.
  const drop = rollCard({
    rank: quest.rank,
    questType: quest.type,
    treats,
    questlines: availableQuestlines(
      profile.main_class,
      isClassId(profile.second_class) ? profile.second_class : null,
      cards,
    ),
    random: seededRandom(`card:${quest.id}`),
  });

  const { data, error } = await supabase.rpc("complete_quest", {
    p_quest_id: quest.id,
    p_proof_type: proof,
    p_summary: cleanSummary,
    p_photo_path: cleanPhoto,
    p_new_points: next.points,
    p_card_kind: drop.kind,
    p_questline_id: drop.questlineId,
  });
  if (error) return { ok: false, error: friendly(error) };
  const saved = data as { awarded: number; card_id: string; card_status: "held" | "pending" };

  return {
    ok: true,
    awarded: saved.awarded,
    stat: quest.stat,
    before,
    after: pointsToGrade(next.points),
    double,
    card: cardView({ ...drop, id: saved.card_id, status: saved.card_status }),
    hand: saved.card_status === "pending" ? handCards(cards).map(cardView) : [],
  };
}

export type ActionState = { error?: string };

// Takes today as this week's rest day.
export async function takeRestDay(): Promise<ActionState> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("sick_since")
    .maybeSingle();
  const today = toIsoDate(new Date());
  const restDays = await loadRestDays(supabase, today);
  if (!canTakeRestDay(restDays.weekly, today)) {
    return { error: "You already took a rest day this week." };
  }
  if (isRestDay(restDays.all, today)) return { error: "Today is already a rest day." };

  const { error } = await saveRestDay(supabase, today, profile?.sick_since ?? null);
  if (error) return { error: SAVE_FAILED };
  refresh();
  return {};
}

// Creates the user's own side quest, then goes back to the quest list.
export async function createSideQuest(input: unknown): Promise<ActionState> {
  const result = validateSideQuest(input);
  if (!result.ok) return { error: result.error };
  const { title, stat, rank } = result.value;

  const supabase = await createClient();
  const today = toIsoDate(new Date());
  const { count } = await supabase
    .from("quests")
    .select("id", { count: "exact", head: true })
    .eq("source", "user")
    .eq("issued_on", today);
  if (!canCreateSideQuest(count ?? 0)) {
    return { error: "You can create 3 side quests a day. Try again tomorrow." };
  }

  const { error } = await supabase.rpc("create_side_quest", {
    p_title: title,
    p_stat: stat,
    p_rank: rank,
  });
  if (error) return { error: friendly(error) };
  redirect("/quests");
}
