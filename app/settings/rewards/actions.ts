"use server";

import { refresh } from "next/cache";
import { REWARD_TIERS, validateTreats } from "@/lib/game/rewards";
import { currentUserId } from "@/lib/supabase/quests";
import { createClient } from "@/lib/supabase/server";

export type SaveTreatsResult = { error?: string; saved?: boolean };

// Saves the user's treats. An empty field removes that tier's treat.
export async function saveTreats(input: unknown): Promise<SaveTreatsResult> {
  const result = validateTreats(input);
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return { error: "Log in again to continue." };

  const set = REWARD_TIERS.filter((tier) => result.value[tier]);
  const cleared = REWARD_TIERS.filter((tier) => !result.value[tier]);
  if (set.length > 0) {
    const { error } = await supabase
      .from("reward_settings")
      .upsert(set.map((tier) => ({ user_id: userId, tier, treat: result.value[tier] })));
    if (error) return { error: "The System could not save that. Try again." };
  }
  if (cleared.length > 0) {
    const { error } = await supabase.from("reward_settings").delete().in("tier", cleared);
    if (error) return { error: "The System could not save that. Try again." };
  }
  refresh();
  return { saved: true };
}
