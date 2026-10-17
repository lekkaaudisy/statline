import { pointsToGrade } from "@/lib/game/grades";
import { STAT_INFO, STATS, type Stat } from "@/lib/game/stats";

export type StatRow = { stat: Stat; points: number; provisional: boolean };

// The status window: one row per stat. Provisional grades are dimmed and
// marked "?" until calibration. Potential is the same C for everyone at the
// start, so it never shows "?".
export function StatusWindow({ rows }: { rows: StatRow[] }) {
  const anyProvisional = rows.some((r) => r.provisional);

  return (
    <div className="mt-4">
      <ul className="divide-y divide-accent/15">
        {STATS.map((stat) => {
          const row = rows.find((r) => r.stat === stat);
          const grade = pointsToGrade(row?.points ?? 0);
          const showQuestionMark = row?.provisional && stat !== "potential";
          return (
            <li key={stat} className="flex items-center justify-between py-3">
              <div>
                <p className="font-display text-base font-bold tracking-wide text-foreground">
                  {STAT_INFO[stat].name}
                </p>
                <p className="text-sm text-muted">{STAT_INFO[stat].meaning}</p>
              </div>
              <p
                className={`font-display text-3xl font-bold ${
                  showQuestionMark
                    ? "text-muted"
                    : stat === "potential"
                      ? "text-gold"
                      : "text-accent"
                }`}
                aria-label={
                  showQuestionMark
                    ? `${grade}, provisional`
                    : `${grade}`
                }
              >
                {grade}
                {showQuestionMark && "?"}
              </p>
            </li>
          );
        })}
      </ul>
      {anyProvisional && (
        <p className="mt-4 rounded-md border border-accent/30 p-3 text-sm text-muted">
          Grades marked &quot;?&quot; are provisional. Your calibration week
          will settle them on real proof.
        </p>
      )}
    </div>
  );
}
