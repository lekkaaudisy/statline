"use server";

import { refresh } from "next/cache";
import { normalizeInviteCode, validateCrewName } from "@/lib/game/crew";
import { createClient } from "@/lib/supabase/server";

const SAVE_FAILED = "The System could not save that. Try again.";

// Database refusals (raised by our own functions) are written for players,
// so they can be shown as they are. Anything else gets a general message.
function friendly(error: { code?: string; message: string }): string {
  return error.code === "P0001" ? error.message : SAVE_FAILED;
}

export type CrewActionResult = { error?: string; message?: string };

export async function createCrew(name: unknown): Promise<CrewActionResult> {
  const result = validateCrewName(name);
  if (!result.ok) return { error: result.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_crew", { p_name: result.value });
  if (error) return { error: friendly(error) };
  refresh();
  return { message: "Crew created. Share the invite code with your friends." };
}

export async function joinCrew(code: unknown): Promise<CrewActionResult> {
  const clean = normalizeInviteCode(code);
  if (!clean) return { error: "Invite codes are 6 letters and numbers." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_crew", { p_code: clean });
  if (error) return { error: friendly(error) };
  refresh();
  return { message: "You joined the crew." };
}

export async function leaveCrew(): Promise<CrewActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_crew");
  if (error) return { error: friendly(error) };
  refresh();
  return { message: "You left the crew." };
}

export async function newInviteCode(): Promise<CrewActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("new_invite_code");
  if (error) return { error: friendly(error) };
  refresh();
  return { message: "New invite code made. The old one no longer works." };
}

// Asks the crew to confirm one of the user's cleared quests.
export async function requestCrewConfirmation(questId: unknown): Promise<CrewActionResult> {
  if (typeof questId !== "string") return { error: SAVE_FAILED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_crew_confirmation", { p_quest_id: questId });
  if (error) return { error: friendly(error) };
  refresh();
  return { message: "Your crew has been asked to confirm this quest." };
}

// Confirms a crewmate's cleared quest as Crew proof.
export async function confirmCrewProof(questId: unknown): Promise<CrewActionResult> {
  if (typeof questId !== "string") return { error: SAVE_FAILED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_crew_proof", { p_quest_id: questId });
  if (error) return { error: friendly(error) };
  refresh();
  return { message: `Confirmed. Your crewmate got +${data as number} points.` };
}
