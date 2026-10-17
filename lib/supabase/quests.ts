import { isClassId } from "@/lib/game/classes";
import { DIFFICULTY_WINDOW_DAYS, REST_DAY_POINTS, REST_DAY_STAT } from "@/lib/game/constants";
import { addDays, toIsoDate, weekStart } from "@/lib/game/dates";
import { applyDecay } from "@/lib/game/decay";
import {
  difficultyCheckDue,
  nextDifficulty,
  type QuestOutcome,
  type QuestType,
} from "@/lib/game/difficulty";
import {
  planQuests,
  type DailyMinutes,
  type ExistingQuest,
  type QuestDraft,
} from "@/lib/game/quests";
import { isRestDay, shouldAutoRest } from "@/lib/game/rest-day";
import { addPoints } from "@/lib/game/stat-state";
import { EARNED_STATS, type EarnedStat } from "@/lib/game/stats";
import { loadStats } from "./player";
import type { createClient } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type QuestStatus = "open" | "cleared" | "missed" | "rested" | "excused";

export type Quest = {
  id: string;
  type: QuestType;
  source: "system" | "user";
  templateId: string | null;
  title: string;
  stat: EarnedStat;
  rank: number;
  gain: number;
  minutes: number | null;
  countsForClass: boolean;
  allowedProofs: string[];
  issuedOn: string;
  dueOn: string;
  status: QuestStatus;
  completedAt: string | null;
};

export const QUEST_COLUMNS =
  "id, type, source, template_id, title, stat, difficulty_rank, gain, minutes, counts_for_class, allowed_proofs, issued_on, due_on, status, completed_at";

type QuestRow = {
  id: string;
  type: QuestType;
  source: "system" | "user";
  template_id: string | null;
  title: string;
  stat: EarnedStat;
  difficulty_rank: number;
  gain: number;
  minutes: number | null;
  counts_for_class: boolean;
  allowed_proofs: string[];
  issued_on: string;
  due_on: string;
  status: QuestStatus;
  completed_at: string | null;
};

export function toQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    templateId: row.template_id,
    title: row.title,
    stat: row.stat,
    rank: row.difficulty_rank,
    gain: row.gain,
    minutes: row.minutes,
    countsForClass: row.counts_for_class,
    allowedProofs: row.allowed_proofs,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    status: row.status,
    completedAt: row.completed_at,
  };
}

function toRow(q: QuestDraft) {
  return {
    type: q.type,
    template_id: q.templateId,
    title: q.title,
    stat: q.stat,
    difficulty_rank: q.rank,
    gain: q.gain,
    minutes: q.minutes,
    counts_for_class: q.countsForClass,
    allowed_proofs: q.allowedProofs,
    issued_on: q.issuedOn,
    due_on: q.dueOn,
    slot: q.slot,
  };
}

// The quest's day as a date, for "cleared today".
export function completedOn(quest: Quest): string | null {
  return quest.completedAt ? toIsoDate(new Date(quest.completedAt)) : null;
}

// The signed-in user's id, from the checked login token.
export async function currentUserId(supabase: Client): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

async function loadRecentQuests(supabase: Client, today: string): Promise<Quest[]> {
  const { data } = await supabase
    .from("quests")
    .select(QUEST_COLUMNS)
    .gte("issued_on", addDays(today, -DIFFICULTY_WINDOW_DAYS))
    .order("created_at", { ascending: true });
  return ((data ?? []) as QuestRow[]).map(toQuest);
}

// Saves the rest day: +5 Endurance, after any decay so far.
export async function saveRestDay(
  supabase: Client,
  today: string,
  sickSince: string | null,
): Promise<{ error?: string }> {
  const { earned } = await loadStats(supabase);
  const next = addPoints(earned[REST_DAY_STAT], REST_DAY_POINTS, today, sickSince);
  const { error } = await supabase.rpc("take_rest_day", { p_new_points: next.points });
  return error ? { error: error.message } : {};
}

export type QuestDay = {
  userId: string;
  today: string;
  quests: Quest[];
  restDays: string[];
  rank: number;
  sick: boolean;
};

// Gets the quest list ready: closes overdue quests, adjusts difficulty once a
// week, takes the Sunday rest day if none was taken, and issues whatever the
// System still owes today. Returns null before onboarding is finished.
export async function prepareQuestDay(supabase: Client): Promise<QuestDay | null> {
  const userId = await currentUserId(supabase);
  if (!userId) return null;

  await supabase.rpc("close_overdue_quests");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "main_class, second_class, goal, daily_minutes, difficulty_rank, difficulty_checked_on, sick_since, onboarded_at",
    )
    .maybeSingle();
  if (!profile?.onboarded_at || !isClassId(profile.main_class)) return null;

  const today = toIsoDate(new Date());
  const sickSince: string | null = profile.sick_since;
  const [{ earned }, quests, { data: restRows }] = await Promise.all([
    loadStats(supabase),
    loadRecentQuests(supabase, today),
    supabase.from("rest_days").select("rest_on").gte("rest_on", weekStart(today)),
  ]);
  const restDays = ((restRows ?? []) as { rest_on: string }[]).map((r) => r.rest_on);

  // Once a week: move difficulty toward a 70-80% success rate.
  let rank: number = profile.difficulty_rank;
  if (difficultyCheckDue(profile.difficulty_checked_on, today)) {
    const outcomes = quests
      .filter(
        (q) =>
          q.source === "system" &&
          (q.type === "daily" || q.type === "main") &&
          q.dueOn < today &&
          (q.status === "cleared" || q.status === "missed"),
      )
      .map((q) => q.status as QuestOutcome);
    const next = nextDifficulty(rank, outcomes);
    const { error } = await supabase.rpc("set_difficulty", { p_rank: next });
    if (!error) rank = next;
  }

  // Sunday with no rest day yet: today is the rest day.
  if (shouldAutoRest(restDays, today)) {
    const { error } = await saveRestDay(supabase, today, sickSince);
    if (!error) restDays.push(today);
  }

  const points = Object.fromEntries(
    EARNED_STATS.map((stat) => [stat, applyDecay({ ...earned[stat], today, sickSince })]),
  ) as Record<EarnedStat, number>;
  const existing: ExistingQuest[] = quests.map((q) => ({
    type: q.type,
    source: q.source,
    issuedOn: q.issuedOn,
    templateId: q.templateId,
    countsForClass: q.countsForClass,
  }));
  const drafts = planQuests({
    seed: userId,
    today,
    player: {
      mainClass: profile.main_class,
      secondClass: isClassId(profile.second_class) ? profile.second_class : null,
      goal: profile.goal ?? "",
      dailyMinutes: profile.daily_minutes as DailyMinutes,
      rank,
      points,
    },
    existing,
    restDay: isRestDay(restDays, today),
  });

  let current = quests;
  if (drafts.length > 0) {
    await supabase.rpc("issue_quests", { p_quests: drafts.map(toRow) });
    current = await loadRecentQuests(supabase, today);
  }

  return { userId, today, quests: current, restDays, rank, sick: Boolean(sickSince) };
}
