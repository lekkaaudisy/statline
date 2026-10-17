"use server";

import { refresh } from "next/cache";
import {
  DEV_IDLE_DAYS,
  DEV_INACTIVE_DAYS,
  DEV_POINT_STEPS,
  DEV_STEADY_DAYS,
} from "@/lib/game/constants";
import { addDays, toIsoDate } from "@/lib/game/dates";
import {
  addPoints,
  resumeAfterSick,
  type StatState,
} from "@/lib/game/stat-state";
import { EARNED_STATS, type EarnedStat } from "@/lib/game/stats";
import { devToolsFlagOn } from "@/lib/dev-tools";
import { loadStats } from "@/lib/supabase/player";
import { createClient } from "@/lib/supabase/server";

// Developer-only test controls. The database refuses these for any account
// not listed in dev_testers.

export type DevResult = { error?: string };

type Change = (
  earned: Record<EarnedStat, StatState>,
  sickSince: string | null,
  today: string,
) => { earned: Record<EarnedStat, StatState>; sickSince: string | null };

async function change(update: Change): Promise<DevResult> {
  if (!devToolsFlagOn()) return { error: "Developer tools are off." };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("sick_since")
    .maybeSingle();
  const { earned } = await loadStats(supabase);
  const today = toIsoDate(new Date());
  const next = update(earned, profile?.sick_since ?? null, today);

  const stats = Object.fromEntries(
    EARNED_STATS.map((stat) => {
      const s = next.earned[stat];
      return [
        stat,
        {
          points: s.points,
          best_grade: s.bestGrade,
          last_active_on: s.lastActiveOn,
          provisional: s.provisional,
        },
      ];
    }),
  );
  const { error } = await supabase.rpc("dev_save", {
    p_stats: stats,
    p_sick_since: next.sickSince,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

function mapStats(
  earned: Record<EarnedStat, StatState>,
  fn: (s: StatState) => StatState,
): Record<EarnedStat, StatState> {
  return Object.fromEntries(
    EARNED_STATS.map((stat) => [stat, fn(earned[stat])]),
  ) as Record<EarnedStat, StatState>;
}

export async function devAddPoints(
  stat: unknown,
  amount: unknown,
): Promise<DevResult> {
  if (!EARNED_STATS.includes(stat as EarnedStat)) {
    return { error: "Unknown stat." };
  }
  if (!DEV_POINT_STEPS.includes(amount as (typeof DEV_POINT_STEPS)[number])) {
    return { error: "Unknown amount." };
  }
  return change((earned, sickSince, today) => ({
    earned: {
      ...earned,
      [stat as EarnedStat]: addPoints(
        earned[stat as EarnedStat],
        amount as number,
        today,
        sickSince,
      ),
    },
    sickSince,
  }));
}

// Moves every earned stat's last active day back, so decay shows.
export async function devMakeInactive(): Promise<DevResult> {
  return change((earned, sickSince, today) => ({
    earned: mapStats(earned, (s) => ({
      ...s,
      lastActiveOn: addDays(today, -DEV_INACTIVE_DAYS),
    })),
    sickSince,
  }));
}

export async function devToggleSick(): Promise<DevResult> {
  return change((earned, sickSince, today) =>
    sickSince
      ? {
          earned: mapStats(earned, (s) => resumeAfterSick(s, sickSince, today)),
          sickSince: null,
        }
      : { earned, sickSince: today },
  );
}

// Pretends a day has passed: moves quest, rest day and activity dates back
// one day, so the next visit is a new quest day.
export async function devPassDay(): Promise<DevResult> {
  if (!devToolsFlagOn()) return { error: "Developer tools are off." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("dev_pass_day");
  if (error) return { error: error.message };
  refresh();
  return {};
}

async function callRpc(name: string, args?: Record<string, unknown>): Promise<DevResult> {
  if (!devToolsFlagOn()) return { error: "Developer tools are off." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, args);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// Fast-forward: idle days pass with nothing done; steady days are each
// marked active (as if a quest was cleared) before they pass.
export async function devPassDays(kind: unknown): Promise<DevResult> {
  if (kind !== "idle" && kind !== "steady") return { error: "Unknown fast-forward." };
  return callRpc("dev_pass_days", {
    p_days: kind === "idle" ? DEV_IDLE_DAYS : DEV_STEADY_DAYS,
    p_steady: kind === "steady",
  });
}

// Starts the first calibration week again from today.
export async function devRestartCalibration(): Promise<DevResult> {
  return callRpc("dev_restart_calibration");
}

// Makes Awakening possible again (clears active days too).
export async function devResetAwakening(): Promise<DevResult> {
  return callRpc("dev_reset_awakening");
}
