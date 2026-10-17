import type { LeaderboardEntry, WeekCounts } from "@/lib/game/crew";

type Row = LeaderboardEntry<{ userId: string; name: string; counts: WeekCounts }>;

// This week's contribution ranking. Effort for the crew only: no stats.
export function Leaderboard({ rows, userId }: { rows: Row[]; userId: string }) {
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r) => {
        const me = r.userId === userId;
        return (
          <li
            key={r.userId}
            className={`flex items-center gap-3 rounded-xl border bg-panel px-4 py-3 ${
              me ? "border-accent" : "border-line"
            }`}
          >
            <span
              className={`w-7 font-display text-lg font-bold ${r.rank === 1 && r.score > 0 ? "text-gold" : "text-muted"}`}
            >
              {r.rank}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold">
                {r.name}
                {me && <span className="text-muted"> (you)</span>}
              </span>
              <span className="text-xs text-muted">
                {r.counts.questsCleared} quests · {r.counts.proofsConfirmed} confirmed ·{" "}
                {r.counts.cardsGifted} gifted
              </span>
            </span>
            <span className="font-display text-xl font-bold text-accent">{r.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
