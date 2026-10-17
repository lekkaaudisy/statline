import { awakeningDay } from "@/lib/game/awakening";
import {
  calibrationPhase,
  generatePlacementQuests,
  isStatSettlement,
  placementForToday,
  placementsDue,
  settleCalibration,
  type CalibrationQuest,
  type PlacementDraft,
  type StatSettlement,
} from "@/lib/game/calibration";
import type { ClassId } from "@/lib/game/classes";
import { AWAKENING_STAT_BOOST } from "@/lib/game/constants";
import { addDays, toIsoDate } from "@/lib/game/dates";
import { applyDecay } from "@/lib/game/decay";
import { pointsToGrade } from "@/lib/game/grades";
import { answersToProvisionalGrades, type Answers } from "@/lib/game/onboarding";
import type { ProofType } from "@/lib/game/proof";
import type { DailyMinutes } from "@/lib/game/quests";
import { addPoints } from "@/lib/game/stat-state";
import { EARNED_STATS, type EarnedStat, type Grade } from "@/lib/game/stats";
import { loadStats } from "./player";
import type { createClient } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Calibration = {
  id: string;
  kind: "first" | "recalibration";
  startedOn: string;
  settledOn: string | null;
  // Each earned stat's result, once settled (empty for old rows).
  results: Record<EarnedStat, StatSettlement> | null;
};

type CalibrationRow = {
  id: string;
  kind: Calibration["kind"];
  started_on: string;
  settled_on: string | null;
  results: unknown;
};

function toResults(value: unknown): Calibration["results"] {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  return EARNED_STATS.every((stat) => isStatSettlement(v[stat]))
    ? (v as Record<EarnedStat, StatSettlement>)
    : null;
}

function toCalibration(row: CalibrationRow): Calibration {
  return {
    id: row.id,
    kind: row.kind,
    startedOn: row.started_on,
    settledOn: row.settled_on,
    results: toResults(row.results),
  };
}

// The user's calibrations, newest first.
export async function loadCalibrations(supabase: Client): Promise<Calibration[]> {
  const { data } = await supabase
    .from("calibrations")
    .select("id, kind, started_on, settled_on, results")
    .order("started_on", { ascending: false });
  return ((data ?? []) as CalibrationRow[]).map(toCalibration);
}

async function loadAnswers(supabase: Client): Promise<Answers> {
  const { data } = await supabase.from("onboarding_answers").select("question_id, answer");
  return Object.fromEntries(
    ((data ?? []) as { question_id: string; answer: number }[]).map((r) => [r.question_id, r.answer]),
  );
}

// The grades the placement quests test. They stay the same all week, so the
// quests do too: the onboarding answers for the first calibration, the last
// settled grades for a recalibration (or the current grades if there are none).
function testedGrades(
  answers: Answers,
  calibrations: readonly Calibration[],
  points: Record<EarnedStat, number>,
): Record<EarnedStat, Grade> {
  const [current, previous] = calibrations;
  if (current.kind === "first") return answersToProvisionalGrades(answers);
  const last = previous?.results;
  return Object.fromEntries(
    EARNED_STATS.map((stat) => [stat, last ? last[stat].after : pointsToGrade(points[stat])]),
  ) as Record<EarnedStat, Grade>;
}

function placementRow(p: PlacementDraft) {
  return {
    type: p.type,
    template_id: p.templateId,
    title: p.title,
    stat: p.stat,
    difficulty_rank: p.rank,
    gain: p.gain,
    minutes: p.minutes,
    counts_for_class: p.countsForClass,
    allowed_proofs: p.allowedProofs,
    slot: p.slot,
  };
}

export type CalibrationWeek = {
  calibration: Calibration;
  // Today's planned placement quest's stat, which takes a daily quest's place.
  placementStat: EarnedStat | null;
};

// In the calibration week, gives any placement quests whose day has come.
// Returns null outside the week.
export async function preparePlacements(
  supabase: Client,
  input: {
    today: string;
    mainClass: ClassId;
    goal: string;
    dailyMinutes: DailyMinutes;
    points: Record<EarnedStat, number>;
    // Placement slots already given in this calibration.
    issuedSlots: (startedOn: string) => Set<number>;
  },
): Promise<CalibrationWeek | null> {
  const calibrations = await loadCalibrations(supabase);
  const calibration = calibrations[0];
  if (!calibration || calibrationPhase(calibration, input.today) !== "week") return null;

  const answers = await loadAnswers(supabase);
  const placements = generatePlacementQuests({
    answers,
    mainClass: input.mainClass,
    goal: input.goal,
    dailyMinutes: input.dailyMinutes,
    grades: testedGrades(answers, calibrations, input.points),
  });
  const due = placementsDue(
    placements,
    calibration.startedOn,
    input.today,
    input.issuedSlots(calibration.startedOn),
  );
  if (due.length > 0) {
    await supabase.rpc("issue_placement_quests", { p_quests: due.map(placementRow) });
  }
  return {
    calibration,
    placementStat: placementForToday(placements, calibration.startedOn, input.today)?.stat ?? null,
  };
}

type WeekQuestRow = {
  id: string;
  type: string;
  stat: EarnedStat;
  status: string;
  due_on: string;
  completed_at: string | null;
};

// Settles a calibration whose week is over. The database refuses a second
// settlement, so this is safe to call on every visit.
export async function settleIfDue(
  supabase: Client,
  calibration: Calibration,
  today: string,
): Promise<{ error?: string }> {
  if (calibrationPhase(calibration, today) !== "due") return {};

  // Main quests can start up to 6 days before the week; anything cleared or
  // missed inside the week counts.
  const { data } = await supabase
    .from("quests")
    .select("id, type, stat, status, due_on, completed_at")
    .gte("due_on", calibration.startedOn)
    .lte("issued_on", addDays(calibration.startedOn, 6));
  const rows = (data ?? []) as WeekQuestRow[];
  const cleared = rows.filter((r) => r.status === "cleared").map((r) => r.id);
  const { data: proofRows } = cleared.length
    ? await supabase.from("quest_proofs").select("quest_id, proof_type").in("quest_id", cleared)
    : { data: [] };
  const proofs = new Map(
    ((proofRows ?? []) as { quest_id: string; proof_type: ProofType }[]).map((p) => [
      p.quest_id,
      p.proof_type,
    ]),
  );
  const quests: CalibrationQuest[] = rows.map((r) => ({
    type: r.type,
    stat: r.stat,
    status: r.status,
    dueOn: r.due_on,
    completedOn: r.completed_at ? toIsoDate(new Date(r.completed_at)) : null,
    proof: proofs.get(r.id) ?? null,
  }));

  // Provisional stats never decay, so the saved points are the points.
  const { earned } = await loadStats(supabase);
  const points = Object.fromEntries(
    EARNED_STATS.map((stat) => [stat, earned[stat].points]),
  ) as Record<EarnedStat, number>;
  const results = settleCalibration({ points, quests, startedOn: calibration.startedOn });

  const { error } = await supabase.rpc("settle_calibration", {
    p_results: Object.fromEntries(
      EARNED_STATS.map((stat) => [
        stat,
        { points: results[stat].points, score: results[stat].score, counted: results[stat].counted },
      ]),
    ),
  });
  return error ? { error: error.message } : {};
}

// Days the user cleared a quest or rested.
export async function loadActiveDays(supabase: Client): Promise<Set<string>> {
  const { data } = await supabase.from("activity_days").select("day");
  return new Set(((data ?? []) as { day: string }[]).map((r) => r.day));
}

export type AwakeningGain = { stat: EarnedStat; before: Grade; after: Grade };

// Gives Awakening if it has happened and was not given yet: the stat boost
// and the Exclusive card. Returns each stat's grade change when given.
export async function awakenIfReady(
  supabase: Client,
  input: { onboardedOn: string; today: string; sickSince: string | null },
): Promise<
  { status: "not-ready" } | { status: "error" } | { status: "given"; gains: AwakeningGain[] }
> {
  const active = await loadActiveDays(supabase);
  if (!awakeningDay(active, input.onboardedOn, input.today)) return { status: "not-ready" };

  const { earned } = await loadStats(supabase);
  const gains: AwakeningGain[] = [];
  const points = {} as Record<EarnedStat, number>;
  for (const stat of EARNED_STATS) {
    const before = pointsToGrade(applyDecay({ ...earned[stat], today: input.today, sickSince: input.sickSince }));
    const next = addPoints(earned[stat], AWAKENING_STAT_BOOST, input.today, input.sickSince);
    points[stat] = next.points;
    gains.push({ stat, before, after: pointsToGrade(next.points) });
  }
  const { error } = await supabase.rpc("awaken", { p_points: points });
  return error ? { status: "error" } : { status: "given", gains };
}
