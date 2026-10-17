"use server";

import { redirect } from "next/navigation";
import { canRecalibrate } from "@/lib/game/calibration";
import { toIsoDate } from "@/lib/game/dates";
import { applyDecay } from "@/lib/game/decay";
import { EARNED_STATS } from "@/lib/game/stats";
import { loadCalibrations } from "@/lib/supabase/calibration";
import { loadStats } from "@/lib/supabase/player";
import { createClient } from "@/lib/supabase/server";

export type RecalibrateResult = { error?: string };

// Starts a new calibration week, once per season. Any decay so far is saved
// first, because provisional grades do not decay.
export async function recalibrate(): Promise<RecalibrateResult> {
  const supabase = await createClient();
  const today = toIsoDate(new Date());
  const [last] = await loadCalibrations(supabase);
  if (!canRecalibrate(last ?? null, today)) {
    return { error: "Recalibration is allowed once per season." };
  }

  const [{ earned }, { data: profile }] = await Promise.all([
    loadStats(supabase),
    supabase.from("profiles").select("sick_since").maybeSingle(),
  ]);
  const sickSince: string | null = profile?.sick_since ?? null;
  const points = Object.fromEntries(
    EARNED_STATS.map((stat) => [stat, applyDecay({ ...earned[stat], today, sickSince })]),
  );
  const { error } = await supabase.rpc("start_recalibration", { p_points: points });
  if (error) {
    return { error: error.code === "P0001" ? error.message : "The System could not save that. Try again." };
  }
  redirect("/quests");
}
