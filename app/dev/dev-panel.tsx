"use client";

import { useState, useTransition } from "react";
import { DEV_INACTIVE_DAYS, DEV_POINT_STEPS } from "@/lib/game/constants";
import { EARNED_STATS, STAT_INFO } from "@/lib/game/stats";
import {
  devAddPoints,
  devMakeInactive,
  devPassDay,
  devToggleProvisional,
  devToggleSick,
  type DevResult,
} from "./actions";

const buttonClass =
  "min-h-11 rounded-md border border-line bg-track px-2 text-sm font-medium text-foreground disabled:opacity-50";

// Test controls for developers only. Shown under the status window when
// NEXT_PUBLIC_DEV_TOOLS=true and the account is in dev_testers.
export function DevPanel({
  sick,
  provisional,
}: {
  sick: boolean;
  provisional: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<DevResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <section
      aria-label="Developer tools"
      className="rounded-[14px] border border-dashed border-gold/60 p-4"
    >
      <p className="font-display text-sm tracking-[0.15em] text-gold">
        DEVELOPER TOOLS
      </p>
      <p className="mt-1 text-xs text-muted">
        Test only. Hidden from normal accounts.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {EARNED_STATS.map((stat) => (
          <li key={stat} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm">{STAT_INFO[stat].name}</span>
            <div className="grid flex-1 grid-cols-3 gap-2">
              {DEV_POINT_STEPS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={pending}
                  className={buttonClass}
                  aria-label={`${amount > 0 ? "Add" : "Remove"} ${Math.abs(amount)} ${STAT_INFO[stat].name} points`}
                  onClick={() => run(() => devAddPoints(stat, amount))}
                >
                  {amount > 0 ? `+${amount}` : amount}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={pending}
          className={buttonClass}
          onClick={() => run(devMakeInactive)}
        >
          Make inactive {DEV_INACTIVE_DAYS} days
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass}
          onClick={() => run(devToggleSick)}
        >
          {sick ? "Clear sick or injured" : "Set sick or injured"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass}
          onClick={() => run(devPassDay)}
        >
          Pass one day (new quests)
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClass}
          onClick={() => run(devToggleProvisional)}
        >
          {provisional ? "Mark calibrated" : "Make provisional again"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-gold">
          {error}
        </p>
      )}
    </section>
  );
}

// Just the "pass one day" control, for the quest list.
export function DevPassDay() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      aria-label="Developer tools"
      className="rounded-[14px] border border-dashed border-gold/60 p-4"
    >
      <p className="font-display text-sm tracking-[0.15em] text-gold">
        DEVELOPER TOOLS
      </p>
      <button
        type="button"
        disabled={pending}
        className={`${buttonClass} mt-3 w-full`}
        onClick={() =>
          startTransition(async () => {
            const result = await devPassDay();
            setError(result.error ?? null);
          })
        }
      >
        Pass one day (new quests)
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-gold">
          {error}
        </p>
      )}
    </section>
  );
}
