"use client";

import { useState, useTransition } from "react";
import { HAND_SIZE } from "@/lib/game/constants";
import { resolvePendingCard } from "./actions";
import { TIER_STYLE } from "./card-tile";
import type { CardView } from "./card-view";

// The hand is full: swap the new card for one in the hand, or discard it.
export function PendingChoice({
  card,
  hand,
  onDone,
}: {
  card: CardView;
  hand: CardView[];
  onDone: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [swapOut, setSwapOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const full = hand.length >= HAND_SIZE;

  function choose(keep: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await resolvePendingCard({ cardId: card.id, keep, swapOut: keep ? swapOut : null });
      if (result.error) setError(result.error);
      else onDone(result.message ?? "");
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="font-display text-sm tracking-[0.15em] text-gold">
        {full ? `YOUR HAND IS FULL · ${HAND_SIZE} / ${HAND_SIZE}` : "NEW CARD WAITING"}
      </p>
      <p className="text-sm text-muted">
        {full
          ? `Choose a card to swap out for ${card.name}, or discard the new card.`
          : `There is room now. Add ${card.name} to your hand, or discard it.`}
      </p>
      {full && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Card to swap out</legend>
          {hand.map((c) => (
            <label
              key={c.id}
              className={`flex min-h-11 items-center gap-3 rounded-[10px] border px-3 py-2 ${
                swapOut === c.id ? "border-accent bg-[#0f2230]" : "border-line bg-panel"
              }`}
            >
              <input
                type="radio"
                name="swap-out"
                value={c.id}
                checked={swapOut === c.id}
                onChange={() => setSwapOut(c.id)}
                className="size-5 accent-[#5ed1f0]"
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{c.name}</span>
                <span className={`text-xs ${TIER_STYLE[c.tier].text}`}>
                  {c.tier} · {c.family}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(false)}
          className="min-h-11 rounded-[10px] border border-line text-sm font-semibold text-foreground disabled:opacity-50"
        >
          Discard new card
        </button>
        <button
          type="button"
          disabled={pending || (full && !swapOut)}
          onClick={() => choose(true)}
          className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-sm font-semibold tracking-wider text-foreground disabled:opacity-40"
        >
          {full ? "SWAP" : "ADD TO HAND"}
        </button>
      </div>
    </div>
  );
}
