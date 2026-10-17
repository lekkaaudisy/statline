"use client";

import { useState, useTransition } from "react";
import { requestCrewConfirmation } from "../../crew/actions";

// Asks the crew to confirm a cleared quest, for the Crew proof top-up.
export function AskCrewButton({ questId, topUp }: { questId: string; topUp: number }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          startTransition(async () => {
            const result = await requestCrewConfirmation(questId);
            if (result.error) setError(result.error);
          })
        }
        className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-sm font-semibold tracking-wider text-accent disabled:opacity-50"
      >
        ASK CREW TO CONFIRM (+{topUp})
      </button>
      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}
    </div>
  );
}
