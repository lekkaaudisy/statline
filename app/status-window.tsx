import type { Momentum } from "@/lib/game/potential";
import type { Progress } from "@/lib/game/grades";
import { STAT_INFO, type EarnedStat, type Grade } from "@/lib/game/stats";

export type StatView = {
  stat: EarnedStat;
  progress: Progress;
  provisional: boolean;
  // Inactive days, when decay is currently taking points. Otherwise null.
  fadingDays: number | null;
};

const SHORT_MEANING: Record<EarnedStat, string> = {
  strength: "Physical capability",
  speed: "Execution",
  endurance: "Consistency",
  intelligence: "Learning",
};

function nextText({ next, pointsToNext }: Progress): string {
  if (next === null) return "Top of the Human range";
  if (next === "SR") return `${pointsToNext} pts to SR`;
  return `${pointsToNext} pts to ${next}`;
}

function momentumText(momentum: Momentum | null): string {
  if (!momentum) return "Momentum shows after your second week.";
  const sign = momentum.perWeek > 0 ? "+" : "";
  return `${momentum.trend} · ${sign}${momentum.perWeek} pts a week`;
}

// The status window: the four earned stats with grade, bar and points to the
// next grade, then Potential shown as momentum. Provisional grades are dimmed
// and marked "?" until calibration.
export function StatusWindow({
  stats,
  potential,
  momentum,
  sick,
}: {
  stats: StatView[];
  potential: Grade;
  momentum: Momentum | null;
  sick: boolean;
}) {
  const anyProvisional = stats.some((s) => s.provisional);

  return (
    <div className="flex flex-col gap-4">
      {sick && (
        <p className="rounded-[10px] border border-accent bg-[#0f2230] px-3.5 py-3 text-sm">
          Sick or injured: decay and penalties are paused. Rest well.
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-[14px] border border-line bg-panel p-[18px]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm tracking-[0.15em] text-accent">
            STATUS WINDOW
          </h2>
          <span className="text-xs text-muted">Human range · F to SSS</span>
        </div>

        {stats.map(({ stat, progress, provisional, fadingDays }) => (
          <div key={stat} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">
                {STAT_INFO[stat].name}
              </span>
              <span
                className={`font-display text-[26px] font-bold ${
                  provisional ? "text-muted" : "text-accent"
                }`}
                aria-label={
                  provisional
                    ? `Grade ${progress.grade}, provisional`
                    : `Grade ${progress.grade}`
                }
              >
                {progress.grade}
                {provisional && "?"}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-[3px] bg-track"
              role="progressbar"
              aria-label={`${STAT_INFO[stat].name} progress to next grade`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <div
                className={`h-full rounded-[3px] ${
                  provisional ? "bg-muted" : "bg-accent"
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              {SHORT_MEANING[stat]} · {nextText(progress)}
            </p>
            {fadingDays !== null && (
              <p className="text-xs text-gold">
                Fading: inactive {fadingDays} days. Clear a quest to stop it.
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-[14px] border border-line bg-panel p-[18px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold">Potential</span>
          <span
            className="font-display text-[26px] font-bold text-gold"
            aria-label={`Potential grade ${potential}`}
          >
            {potential}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">
          {momentumText(momentum)}
        </p>
        <p className="text-[13px] leading-normal text-muted">
          Your momentum, not your talent. It rises when your other stats grow
          faster. Clear quests to raise it.
        </p>
      </section>

      {anyProvisional && (
        <p className="rounded-[10px] border border-line p-3 text-sm text-muted">
          Grades marked &quot;?&quot; are provisional. Your calibration week
          will settle them on real proof.
        </p>
      )}
    </div>
  );
}
