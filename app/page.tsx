import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "./app-shell";
import { DevPanel } from "./dev/dev-panel";
import { StatusWindow, type StatView } from "./status-window";
import { awakeningDay, comebackProgress } from "@/lib/game/awakening";
import { calibrationDay, calibrationPhase } from "@/lib/game/calibration";
import { CLASS_INFO, isClassId } from "@/lib/game/classes";
import {
  AWAKENING_MIN_ACTIVE_DAYS,
  AWAKENING_STEADY_DAYS,
  CALIBRATION_DAYS,
  DECAY_START_DAYS,
} from "@/lib/game/constants";
import { toIsoDate, weekStart } from "@/lib/game/dates";
import { applyDecay, countedInactiveDays } from "@/lib/game/decay";
import { gradeToPoints, pointsToGrade, progressToNext } from "@/lib/game/grades";
import {
  calculatePotential,
  momentumOf,
  weeklyGain,
  type WeeklySnapshot,
} from "@/lib/game/potential";
import { EARNED_STATS, type EarnedStat } from "@/lib/game/stats";
import { devToolsFlagOn } from "@/lib/dev-tools";
import { loadActiveDays, loadCalibrations } from "@/lib/supabase/calibration";
import { loadStats } from "@/lib/supabase/player";
import { createClient } from "@/lib/supabase/server";

type HistoryRow = { week_start: string; potential: number } & Record<
  EarnedStat,
  number
>;

async function Status() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, main_class, second_class, onboarded_at, sick_since, awakened_on")
    .maybeSingle();

  // New players go through onboarding first.
  if (!profile?.onboarded_at) redirect("/onboarding");

  const today = toIsoDate(new Date());
  const sickSince: string | null = profile.sick_since;

  // Day 8: the calibration result comes first.
  const [calibration] = await loadCalibrations(supabase);
  const phase = calibration ? calibrationPhase(calibration, today) : null;
  if (phase === "due") redirect("/calibration");

  // Awakening, once it has happened and until it is given.
  const onboardedOn = toIsoDate(new Date(profile.onboarded_at));
  const activeDays = profile.awakened_on ? null : await loadActiveDays(supabase);
  if (activeDays && awakeningDay(activeDays, onboardedOn, today)) redirect("/awakening");
  const comeback = activeDays ? comebackProgress(activeDays, onboardedOn, today) : null;
  const [{ earned, potentialPoints }, { data: historyRows }, devTester] =
    await Promise.all([
      loadStats(supabase),
      supabase
        .from("stat_history")
        .select("week_start, strength, speed, endurance, intelligence, potential")
        .order("week_start", { ascending: false })
        .limit(6),
      devToolsFlagOn()
        ? supabase.from("dev_testers").select("user_id").maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Points after decay. Decay is worked out on each visit, not saved.
  const current = Object.fromEntries(
    EARNED_STATS.map((stat) => [
      stat,
      applyDecay({ ...earned[stat], today, sickSince }),
    ]),
  ) as Record<EarnedStat, number>;

  let history: WeeklySnapshot[] = ((historyRows ?? []) as HistoryRow[]).map(
    ({ week_start, ...points }) => ({ weekStart: week_start, ...points }),
  );
  let potential = pointsToGrade(potentialPoints);

  // First visit this week: save a snapshot and recalculate Potential.
  const thisWeek = weekStart(today);
  if (!history.some((h) => h.weekStart === thisWeek)) {
    const snapshot = { weekStart: thisWeek, ...current, potential: 0 };
    const nextPotential = calculatePotential([...history, snapshot], potential);
    snapshot.potential = gradeToPoints(nextPotential);
    const { data: saved } = await supabase.rpc("record_week", {
      p_week_start: thisWeek,
      p_points: current,
      p_potential_points: snapshot.potential,
    });
    if (saved) {
      history = [...history, snapshot];
      potential = nextPotential;
    }
  }

  const stats: StatView[] = EARNED_STATS.map((stat) => {
    const days = countedInactiveDays(earned[stat].lastActiveOn, today, sickSince);
    const fading =
      !earned[stat].provisional && !sickSince && days >= DECAY_START_DAYS;
    return {
      stat,
      progress: progressToNext(current[stat]),
      provisional: earned[stat].provisional,
      fadingDays: fading ? days : null,
    };
  });

  const classNames = [profile.main_class, profile.second_class]
    .filter(isClassId)
    .map((id) => CLASS_INFO[id].name)
    .join(" + ");

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-wide">
          {profile.display_name}
        </h1>
        <p className="text-right text-sm text-muted">Class: {classNames}</p>
      </div>
      {calibration && phase === "week" && (
        <Link
          href="/quests"
          className="mb-4 flex min-h-11 flex-col justify-center gap-0.5 rounded-[10px] border border-accent bg-[#0f2230] px-3.5 py-3"
        >
          <span className="font-display text-sm font-semibold tracking-wider text-accent">
            CALIBRATION WEEK · DAY {calibrationDay(calibration.startedOn, today)} OF{" "}
            {CALIBRATION_DAYS}
          </span>
          <span className="text-[13px] text-foreground">
            Clear your placement quests with proof. Your grades settle on day{" "}
            {CALIBRATION_DAYS + 1}.
          </span>
        </Link>
      )}
      {comeback && (
        <p className="mb-4 rounded-[10px] border border-gold/60 px-3.5 py-3 text-[13px]">
          <span className="font-display font-semibold tracking-wider text-gold">COMEBACK. </span>
          {comeback.activeDays} active days in the last {comeback.days}. Keep{" "}
          {AWAKENING_MIN_ACTIVE_DAYS} of {AWAKENING_STEADY_DAYS} days steady to awaken.
        </p>
      )}
      <StatusWindow
        stats={stats}
        potential={potential}
        momentum={momentumOf(weeklyGain(history))}
        sick={Boolean(sickSince)}
      />
      {phase === "settled" && calibration?.results && (
        <Link
          href="/calibration"
          className="mt-4 flex min-h-11 items-center justify-center rounded-[10px] border border-line font-display text-sm font-semibold tracking-wider text-accent"
        >
          CALIBRATION RESULTS
        </Link>
      )}
      {devTester.data && (
        <div className="mt-4">
          <DevPanel sick={Boolean(sickSince)} />
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <AppShell active="status">
      <Suspense fallback={<p className="text-base text-muted">Loading status</p>}>
        <Status />
      </Suspense>
    </AppShell>
  );
}
