import { CLASS_INFO } from "@/lib/game/classes";
import { STATS, STAT_INFO } from "@/lib/game/stats";
import type { CrewMember } from "@/lib/supabase/crew";

// Crewmates with their grade summary: letter grades only. Provisional grades
// are never shown to the crew.
export function MemberList({ members, userId }: { members: CrewMember[]; userId: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => {
        const calibrating = STATS.every((s) => m.grades[s] === null);
        return (
          <li key={m.userId} className="flex flex-col gap-2.5 rounded-xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-semibold">
                {m.name}
                {m.userId === userId && <span className="text-muted"> (you)</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {m.mainClass ? CLASS_INFO[m.mainClass].name : ""}
                {m.role === "owner" && " · Owner"}
              </span>
            </div>
            {calibrating ? (
              <p className="text-xs text-muted">Calibrating: grades appear after the first week.</p>
            ) : (
              <dl className="grid grid-cols-5 gap-1 text-center">
                {STATS.map((s) => (
                  <div key={s} className="flex flex-col gap-0.5">
                    <dt className="text-[10px] tracking-wider text-muted">
                      {STAT_INFO[s].name.slice(0, 3).toUpperCase()}
                    </dt>
                    <dd className="font-display text-lg font-bold">{m.grades[s] ?? "–"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
