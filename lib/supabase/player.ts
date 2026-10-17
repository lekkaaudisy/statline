import type { StatState } from "@/lib/game/stat-state";
import { EARNED_STATS, type EarnedStat, type Grade } from "@/lib/game/stats";
import type { createClient } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

type StatRow = {
  stat: string;
  points: number;
  best_grade: Grade | null;
  last_active_on: string | null;
  provisional: boolean;
};

export type PlayerStats = {
  earned: Record<EarnedStat, StatState>;
  potentialPoints: number;
};

// Reads the signed-in user's five stats. Rows the user does not have yet
// (before onboarding) come back as zero.
export async function loadStats(supabase: Client): Promise<PlayerStats> {
  const { data } = await supabase
    .from("stats")
    .select("stat, points, best_grade, last_active_on, provisional");
  const rows = (data ?? []) as StatRow[];
  const byStat = new Map(rows.map((r) => [r.stat, r]));

  const earned = {} as Record<EarnedStat, StatState>;
  for (const stat of EARNED_STATS) {
    const row = byStat.get(stat);
    earned[stat] = {
      points: row?.points ?? 0,
      bestGrade: row?.best_grade ?? null,
      lastActiveOn: row?.last_active_on ?? null,
      provisional: row?.provisional ?? true,
    };
  }
  return { earned, potentialPoints: byStat.get("potential")?.points ?? 0 };
}
