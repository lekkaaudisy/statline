"use client";

import { useState, useTransition } from "react";
import { confirmCrewProof } from "./actions";

export type RequestView = {
  questId: string;
  name: string;
  title: string;
  statName: string;
  rank: number;
  proofName: string;
  summary: string | null;
  topUp: number;
};

// Crewmates' cleared quests waiting for a confirmation.
export function ConfirmRequests({ requests }: { requests: RequestView[] }) {
  const [busy, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {note && (
        <p role="status" className="rounded-[10px] border border-accent bg-[#0f2230] px-3.5 py-3 text-sm">
          {note}
        </p>
      )}
      {requests.map((r) => (
        <article key={r.questId} className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4">
          <span className="text-xs text-muted">
            {r.name} · {r.statName} · Rank {r.rank} · {r.proofName} proof
          </span>
          <span className="font-display text-[15px] font-semibold">{r.title}</span>
          {r.summary && <p className="text-[13px] leading-normal text-[#c3cedb]">{r.summary}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const result = await confirmCrewProof(r.questId);
                setNote(result.error ?? result.message ?? null);
              })
            }
            className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-sm font-semibold tracking-wider text-accent disabled:opacity-50"
          >
            CONFIRM (+{r.topUp} FOR {r.name.toUpperCase()})
          </button>
        </article>
      ))}
    </div>
  );
}
