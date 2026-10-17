import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "../app-shell";
import { CardTile } from "../cards/card-tile";
import { cardView } from "../cards/card-view";
import {
  calibrationDay,
  calibrationPhase,
  canRecalibrate,
  recalibrationOpensOn,
  type StatSettlement,
} from "@/lib/game/calibration";
import { CALIBRATION_DAYS } from "@/lib/game/constants";
import { toIsoDate } from "@/lib/game/dates";
import { GRADES, STAT_INFO, EARNED_STATS } from "@/lib/game/stats";
import { loadCalibrations, settleIfDue } from "@/lib/supabase/calibration";
import { loadProofCard } from "@/lib/supabase/cards";
import { createClient } from "@/lib/supabase/server";
import { RecalibrateButton } from "./recalibrate-button";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// Why the grade settled where it did. Never "declined": a lower grade is
// simply where the proof placed it.
function reason(result: StatSettlement): string {
  const move = GRADES.indexOf(result.after) - GRADES.indexOf(result.before);
  if (result.score === null) {
    return result.counted === 0
      ? "No proof this week, so your grade is kept."
      : "Only one quest to go on, so your grade is kept.";
  }
  const proof = `Proof score ${Math.round(result.score * 100)}% from ${result.counted} quests.`;
  if (move > 0) return `${proof} Placed one step higher.`;
  if (move < 0) return `${proof} Placed one step lower.`;
  return `${proof} Placed where you are.`;
}

function ResultRow({ stat, result }: { stat: (typeof EARNED_STATS)[number]; result: StatSettlement }) {
  const changed = result.before !== result.after;
  return (
    <div className="flex flex-col gap-1.5 border-b border-track pb-3.5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold">{STAT_INFO[stat].name}</span>
        <span
          className="flex items-baseline gap-2 font-display"
          aria-label={`${STAT_INFO[stat].name}: provisional ${result.before}, calibrated ${result.after}`}
        >
          <span className="text-lg text-muted">{result.before}?</span>
          <span className="text-sm text-muted" aria-hidden="true">
            to
          </span>
          <span className={`text-[26px] font-bold ${changed ? "text-gold" : "text-accent"}`}>
            {result.after}
          </span>
        </span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-normal text-muted">{reason(result)}</p>
        <span className="shrink-0 rounded-md border border-accent px-2 py-0.5 text-[11px] font-semibold tracking-wider text-accent">
          CALIBRATED
        </span>
      </div>
    </div>
  );
}

async function Calibration() {
  const supabase = await createClient();
  const today = toIsoDate(new Date());
  let [calibration] = await loadCalibrations(supabase);
  if (!calibration) redirect("/");

  // Day 8: settle now. Safe to repeat: the database settles only once.
  if (calibrationPhase(calibration, today) === "due") {
    await settleIfDue(supabase, calibration, today);
    [calibration] = await loadCalibrations(supabase);
  }

  const phase = calibrationPhase(calibration, today);
  if (phase !== "settled") {
    return (
      <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-panel p-[18px]">
        <h1 className="font-display text-sm tracking-[0.15em] text-accent">
          CALIBRATION WEEK · DAY {Math.min(calibrationDay(calibration.startedOn, today), CALIBRATION_DAYS)} OF{" "}
          {CALIBRATION_DAYS}
        </h1>
        <p className="text-sm leading-normal">
          {phase === "due"
            ? "The System could not settle your grades just now. Try again in a moment."
            : `Your grades settle on day ${CALIBRATION_DAYS + 1}, on the proof from your placement quests.`}
        </p>
        <Link
          href="/quests"
          className="flex min-h-11 items-center justify-center rounded-[10px] border border-accent bg-[#0f2230] font-display text-sm font-semibold tracking-wider"
        >
          {phase === "due" ? "BACK TO QUESTS" : "PLACEMENT QUESTS"}
        </Link>
      </section>
    );
  }

  const dayOne = calibration.kind === "first" ? await loadProofCard(supabase, "day_one") : null;
  const opensOn = recalibrationOpensOn(calibration.startedOn);
  const results = calibration.results;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <p className="font-display text-sm tracking-[0.3em] text-accent">CALIBRATION COMPLETE</p>
        <h1 className="font-display text-2xl font-bold">Your grades are calibrated</h1>
        <p className="text-sm leading-normal text-muted">
          {calibration.kind === "first" ? "Your first week" : "This calibration week"} is
          measured. Each grade has settled on real proof.
        </p>
      </div>

      {results && (
        <section className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-panel p-[18px]">
          <h2 className="font-display text-sm tracking-[0.15em] text-accent">STATUS WINDOW</h2>
          {EARNED_STATS.map((stat) => (
            <ResultRow key={stat} stat={stat} result={results[stat]} />
          ))}
        </section>
      )}

      {dayOne && (
        <section className="flex flex-col items-center gap-3">
          <p className="font-display text-sm tracking-[0.3em] text-gold">PROOF CARD EARNED</p>
          <CardTile card={cardView(dayOne)} size="large" />
          <p className="max-w-xs text-center text-xs leading-normal text-muted">
            Kept with your Proof cards. It never counts toward your hand of 10.
          </p>
        </section>
      )}

      <Link
        href="/"
        className="flex min-h-12 items-center justify-center rounded-[10px] border border-accent bg-[#0f2230] font-display text-[15px] font-semibold tracking-wider"
      >
        TO STATUS WINDOW
      </Link>

      <section className="flex flex-col gap-2 border-t border-track pt-4">
        <h2 className="font-display text-sm tracking-[0.15em] text-muted">RECALIBRATION</h2>
        {canRecalibrate(calibration, today) ? (
          <RecalibrateButton />
        ) : (
          <p className="text-xs leading-normal text-muted">
            You can recalibrate once per season. Next chance: {shortDate(opensOn)}.
          </p>
        )}
      </section>
    </div>
  );
}

export default function CalibrationPage() {
  return (
    <AppShell active="status">
      <Suspense fallback={<p className="text-base text-muted">Loading calibration</p>}>
        <Calibration />
      </Suspense>
    </AppShell>
  );
}
