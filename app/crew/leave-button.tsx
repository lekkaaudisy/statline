"use client";

import { useState, useTransition } from "react";
import { leaveCrew } from "./actions";

export function LeaveButton({ owner }: { owner: boolean }) {
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-4">
      {confirming ? (
        <>
          <p className="text-[13px] leading-normal text-muted">
            Leave this crew? Your quests, stats and cards stay with you.
            {owner && " The member who joined first becomes the new owner."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-[10px] border border-line text-sm font-semibold text-foreground"
            >
              Stay
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  const result = await leaveCrew();
                  if (result.error) setError(result.error);
                })
              }
              className="min-h-11 rounded-[10px] border border-gold bg-[#2a2210] font-display text-sm font-semibold tracking-wider text-gold disabled:opacity-50"
            >
              LEAVE
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 rounded-[10px] border border-line font-display text-sm font-semibold tracking-wider text-muted"
        >
          LEAVE CREW
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}
    </div>
  );
}
