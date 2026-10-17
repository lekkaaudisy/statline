"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { toIsoDate } from "@/lib/game/dates";
import { applyDecay } from "@/lib/game/decay";
import { pointsToGrade } from "@/lib/game/grades";
import { isSelectableProof, proofError, proofPoints } from "@/lib/game/proof";
import { canCreateSideQuest, validateSideQuest } from "@/lib/game/quests";
import { canTakeRestDay } from "@/lib/game/rest-day";
import { addPoints } from "@/lib/game/stat-state";
import type { EarnedStat, Grade } from "@/lib/game/stats";
import { loadStats } from "@/lib/supabase/player";
import {
  currentUserId,
  QUEST_COLUMNS,
  saveRestDay,
  toQuest,
} from "@/lib/supabase/quests";
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
    }
  | { ok: false; error: string };

// Completes a quest with proof. Photos are uploaded from the phone first, so
// this only receives the photo's path.
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

  const [{ earned }, { data: profile }] = await Promise.all([
    loadStats(supabase),
    supabase.from("profiles").select("sick_since").maybeSingle(),
  ]);
  const sickSince: string | null = profile?.sick_since ?? null;
  const stat = earned[quest.stat];
  const awarded = proofPoints(quest.gain, proof);
  const before = pointsToGrade(applyDecay({ ...stat, today, sickSince }));
  const next = addPoints(stat, awarded, today, sickSince);

  const { error } = await supabase.rpc("complete_quest", {
    p_quest_id: quest.id,
    p_proof_type: proof,
    p_summary: cleanSummary,
    p_photo_path: cleanPhoto,
    p_new_points: next.points,
  });
  if (error) return { ok: false, error: friendly(error) };

  return {
    ok: true,
    awarded,
    stat: quest.stat,
    before,
    after: pointsToGrade(next.points),
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
  const { data: rows } = await supabase.from("rest_days").select("rest_on");
  const restDays = ((rows ?? []) as { rest_on: string }[]).map((r) => r.rest_on);
  if (!canTakeRestDay(restDays, today)) {
    return { error: "You already took a rest day this week." };
  }

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
