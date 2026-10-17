"use client";

import { useState, useTransition } from "react";
import { recalibrate } from "./actions";

// Recalibration asks once more before it starts, because it makes the
// grades provisional again for a week.
export function RecalibrateButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded-[10px] border border-line font-display text-sm font-semibold tracking-wider text-accent"
      >
        RECALIBRATE
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-normal">
        Your grades become provisional for a new 7-day calibration week, then settle on
        proof again. Your points are kept. You can do this once per season.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="min-h-11 rounded-[10px] border border-line text-sm text-muted disabled:opacity-50"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await recalibrate();
              if (result?.error) setError(result.error);
            })
          }
          className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-sm font-semibold tracking-wider disabled:opacity-50"
        >
          START WEEK
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}
    </div>
  );
}
