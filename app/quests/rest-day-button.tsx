"use client";

import { useState, useTransition } from "react";
import { takeRestDay } from "./actions";

export function RestDayButton({ points }: { points: number }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function take() {
    setError(null);
    startTransition(async () => {
      const result = await takeRestDay();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-4">
      <p className="text-[13px] leading-normal text-muted">
        One rest day a week counts as progress (+{points} Endurance). Today&apos;s
        dailies become rested, with no penalty. If you don&apos;t pick one,
        Sunday is your rest day.
      </p>
      {confirming ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-11 rounded-[10px] border border-line text-sm font-semibold text-foreground"
          >
            Not today
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={take}
            className="min-h-11 rounded-[10px] border border-gold bg-[#2a2210] font-display text-sm font-semibold tracking-wider text-gold disabled:opacity-50"
          >
            {pending ? "SAVING" : "REST TODAY"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 rounded-[10px] border border-line font-display text-sm font-semibold tracking-wider text-gold"
        >
          TAKE TODAY AS REST DAY
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
