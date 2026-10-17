import { isClassId, type ClassId } from "@/lib/game/classes";
import type { WeekCounts } from "@/lib/game/crew";
import { STATS, type Grade, type Stat } from "@/lib/game/stats";
import type { ProofType } from "@/lib/game/proof";
import type { createClient } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Crew = { id: string; name: string; inviteCode: string };

// The signed-in user's crew, or null. RLS only shows the user's own crew.
export async function loadCrew(supabase: Client): Promise<Crew | null> {
  const { data } = await supabase.from("crews").select("id, name, invite_code").maybeSingle();
  return data ? { id: data.id, name: data.name, inviteCode: data.invite_code } : null;
}

export type CrewMember = {
  userId: string;
  name: string;
  mainClass: ClassId | null;
  role: "owner" | "member";
  // Letter grades only. Null while the grade is still provisional.
  grades: Record<Stat, Grade | null>;
};

type SummaryRow = {
  user_id: string;
  display_name: string;
  main_class: string | null;
  role: "owner" | "member";
} & Record<Stat, Grade | null>;

// Everyone in the crew with their grade summary (never points).
export async function loadCrewMembers(supabase: Client): Promise<CrewMember[]> {
  const { data } = await supabase.rpc("crew_member_summaries");
  return ((data ?? []) as SummaryRow[]).map((r) => ({
    userId: r.user_id,
    name: r.display_name,
    mainClass: isClassId(r.main_class) ? r.main_class : null,
    role: r.role,
    grades: Object.fromEntries(STATS.map((s) => [s, r[s]])) as Record<Stat, Grade | null>,
  }));
}

type CountRow = {
  user_id: string;
  quests_cleared: number;
  proofs_confirmed: number;
  cards_gifted: number;
};

// Each member's counts for the week starting on this Monday.
export async function loadWeekCounts(
  supabase: Client,
  monday: string,
): Promise<Map<string, WeekCounts>> {
  const { data } = await supabase.rpc("crew_week_counts", { p_week_start: monday });
  return new Map(
    ((data ?? []) as CountRow[]).map((r) => [
      r.user_id,
      {
        questsCleared: r.quests_cleared,
        proofsConfirmed: r.proofs_confirmed,
        cardsGifted: r.cards_gifted,
      },
    ]),
  );
}

export type ConfirmationRequest = {
  questId: string;
  name: string;
  title: string;
  stat: Stat;
  rank: number;
  gain: number;
  proofType: ProofType;
  pointsAwarded: number;
  summary: string | null;
  completedAt: string;
};

type RequestRow = {
  quest_id: string;
  display_name: string;
  title: string;
  stat: Stat;
  difficulty_rank: number;
  gain: number;
  proof_type: ProofType;
  points_awarded: number;
  summary: string | null;
  completed_at: string;
};

// Crewmates' cleared quests waiting for confirmation (not the user's own).
export async function loadConfirmationRequests(supabase: Client): Promise<ConfirmationRequest[]> {
  const { data } = await supabase.rpc("crew_confirmation_requests");
  return ((data ?? []) as RequestRow[]).map((r) => ({
    questId: r.quest_id,
    name: r.display_name,
    title: r.title,
    stat: r.stat,
    rank: r.difficulty_rank,
    gain: r.gain,
    proofType: r.proof_type,
    pointsAwarded: r.points_awarded,
    summary: r.summary,
    completedAt: r.completed_at,
  }));
}
