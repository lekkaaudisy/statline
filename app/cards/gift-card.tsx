"use client";

import { useState } from "react";

export type Crewmate = { id: string; name: string };

const buttonClass =
  "min-h-11 rounded-lg border border-[#3a4d69] bg-[#18222f] text-[13px] font-semibold text-foreground disabled:opacity-50";

// Picks a crewmate to gift a System card to.
export function GiftCard({
  cardId,
  crewmates,
  busy,
  onCancel,
  onGift,
}: {
  cardId: string;
  crewmates: Crewmate[];
  busy: boolean;
  onCancel: () => void;
  onGift: (toUserId: string) => void;
}) {
  const [to, setTo] = useState<string | null>(null);
  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs text-muted">Gift to</legend>
        {crewmates.map((m) => (
          <label key={m.id} className="flex min-h-11 items-center gap-2 text-xs leading-snug">
            <input
              type="radio"
              name={`gift-${cardId}`}
              checked={to === m.id}
              onChange={() => setTo(m.id)}
              className="size-5 shrink-0 accent-[#5ed1f0]"
            />
            <span className="truncate">{m.name}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted">A gifted card can&apos;t be passed on again.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !to}
          className={`${buttonClass} border-accent`}
          onClick={() => to && onGift(to)}
        >
          Gift
        </button>
      </div>
    </>
  );
}
