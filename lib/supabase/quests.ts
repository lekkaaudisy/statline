import { nextSkillSteps, shieldDay, type SkillStepDraft } from "@/lib/game/card-effects";
import type { Card } from "@/lib/game/cards";
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
import { mainQuestPenalty } from "@/lib/game/main-penalty";
import { isRestDay, shouldAutoRest } from "@/lib/game/rest-day";
import { addPoints } from "@/lib/game/stat-state";
import { EARNED_STATS, type EarnedStat } from "@/lib/game/stats";
import { loadCards } from "./cards";
import { loadStats } from "./player";
import type { createClient } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type QuestStatus =
  | "open"
  | "cleared"
  | "missed"
  | "rested"
  | "excused"
  | "rerolled"
  | "shielded";

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
  slot: number | null;
  // Skill steps: the Skill card whose questline gave it.
  cardId: string | null;
  // Failed main quests: what the penalty took, once applied.
  penalty: "card" | "dent" | "none" | null;
};

export const QUEST_COLUMNS =
  "id, type, source, template_id, title, stat, difficulty_rank, gain, minutes, counts_for_class, allowed_proofs, issued_on, due_on, status, completed_at, slot, card_id, penalty";

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
  slot: number | null;
  card_id: string | null;
  penalty: Quest["penalty"];
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
    slot: row.slot,
    cardId: row.card_id,
    penalty: row.penalty,
  };
}

function toRow(q: QuestDraft | SkillStepDraft) {
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
    card_id: "cardId" in q ? q.cardId : null,
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

export type RestDayRow = { rest_on: string; kind: "weekly" | "card" };

// This week's rest days: all of them (no dailies on any), and the weekly
// ones (one a week, +5 Endurance). Rest cards are not the weekly rest day.
export async function loadRestDays(
  supabase: Client,
  today: string,
): Promise<{ all: string[]; weekly: string[] }> {
  const { data } = await supabase
    .from("rest_days")
    .select("rest_on, kind")
    .gte("rest_on", weekStart(today));
  const rows = (data ?? []) as RestDayRow[];
  return {
    all: rows.map((r) => r.rest_on),
    weekly: rows.filter((r) => r.kind === "weekly").map((r) => r.rest_on),
  };
}

export type QuestDay = {
  userId: string;
  today: string;
  quests: Quest[];
  restDays: string[];
  weeklyRestDays: string[];
  cards: Card[];
  rank: number;
  sick: boolean;
};

// An active Shield covers the first missed day since it was raised, then
// each failed main quest costs one held card or a small stat dent. Returns
// whether anything changed.
async function settleMissedQuests(
  supabase: Client,
  quests: Quest[],
  cards: Card[],
): Promise<boolean> {
  let changed = false;
  const shield = cards.find((c) => c.kind === "shield" && c.status === "active");
  if (shield?.activatedOn) {
    const day = shieldDay(shield.activatedOn, quests);
    if (day) {
      const { error } = await supabase.rpc("apply_shield", { p_card_id: shield.id, p_day: day });
      if (!error) {
        shield.status = "used";
        for (const q of quests) {
          if (q.dueOn === day && q.status === "missed" && q.penalty === null && (q.type === "daily" || q.type === "main")) {
            q.status = "shielded";
          }
        }
        changed = true;
      }
    }
  }

  const failed = quests.filter((q) => q.type === "main" && q.status === "missed" && q.penalty === null);
  if (failed.length === 0) return changed;
  const { earned } = await loadStats(supabase);
  for (const quest of failed) {
    const penalty = mainQuestPenalty(cards, earned[quest.stat]);
    const { error } = await supabase.rpc("apply_main_penalty", {
      p_quest_id: quest.id,
      p_card_id: penalty.kind === "card" ? penalty.cardId : null,
      p_new_points: penalty.kind === "dent" ? penalty.newPoints : null,
    });
    if (error) continue;
    changed = true;
    if (penalty.kind === "card") {
      const lost = cards.find((c) => c.id === penalty.cardId);
      if (lost) lost.status = "lost";
    } else {
      earned[quest.stat] = { ...earned[quest.stat], points: penalty.newPoints };
    }
  }
  return changed;
}

// Gets the quest list ready: closes overdue quests, lets an active Shield
// cover a missed day, applies failed main quest penalties, adjusts difficulty
// once a week, takes the Sunday rest day if none was taken, and issues
// whatever the System still owes today, including the next Skill questline
// steps. Returns null before onboarding is finished.
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
  let [quests, cards] = await Promise.all([
    loadRecentQuests(supabase, today),
    loadCards(supabase),
  ]);
  if (await settleMissedQuests(supabase, quests, cards)) {
    [quests, cards] = await Promise.all([loadRecentQuests(supabase, today), loadCards(supabase)]);
  }
  const [{ earned }, rest] = await Promise.all([loadStats(supabase), loadRestDays(supabase, today)]);
  const { all: restDays, weekly: weeklyRestDays } = rest;

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
  if (shouldAutoRest(weeklyRestDays, today) && !isRestDay(restDays, today)) {
    const { error } = await saveRestDay(supabase, today, sickSince);
    if (!error) {
      restDays.push(today);
      weeklyRestDays.push(today);
    }
  }

  const points = Object.fromEntries(
    EARNED_STATS.map((stat) => [stat, applyDecay({ ...earned[stat], today, sickSince })]),
  ) as Record<EarnedStat, number>;
  // A rerolled quest's replacement takes its place.
  const existing: ExistingQuest[] = quests.filter((q) => q.status !== "rerolled").map((q) => ({
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

  // Skill steps come after today's quests, so the strength cap sees them.
  const steps = nextSkillSteps(cards, current, today);
  if (steps.length > 0) {
    await supabase.rpc("issue_quests", { p_quests: steps.map(toRow) });
    current = await loadRecentQuests(supabase, today);
  }

  return {
    userId,
    today,
    quests: current,
    restDays,
    weeklyRestDays,
    cards,
    rank,
    sick: Boolean(sickSince),
  };
}
