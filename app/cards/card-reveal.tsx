"use client";

import { useState } from "react";
import { STAT_INFO, type EarnedStat, type Grade } from "@/lib/game/stats";
import { CardTile } from "./card-tile";
import type { CardView } from "./card-view";
import { PendingChoice } from "./pending-choice";

// The "Quest cleared" moment from the prototype: the stat gain, any rank-up,
// and the card the quest paid out. A card that dropped into a full hand asks
// for a swap or a discard (or can wait on the hand screen).
export function CardReveal({
  awarded,
  stat,
  before,
  after,
  double,
  card,
  hand,
  onClose,
}: {
  awarded: number;
  stat: EarnedStat;
  before: Grade;
  after: Grade;
  double: boolean;
  card: CardView;
  hand: CardView[];
  onClose: () => void;
}) {
  const [waiting, setWaiting] = useState(card.status === "pending");
  const name = STAT_INFO[stat].name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cleared-title"
      className="fixed inset-0 z-10 overflow-y-auto bg-[rgba(5,8,13,0.96)]"
    >
      {/* Centred when it fits; scrolls from the top when the swap list is long. */}
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-8">
      <p id="cleared-title" className="font-display text-sm tracking-[0.3em] text-accent">
        QUEST CLEARED
      </p>
      <p className="font-display text-2xl font-bold">
        +{awarded} {name}
        {double && " (double)"}
      </p>
      {before !== after && (
        <p className="text-[15px] font-semibold text-gold">
          {name} rank up: {before} to {after}
        </p>
      )}
      <CardTile card={card} size="large" />
      {waiting ? (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <PendingChoice card={card} hand={hand} onDone={() => setWaiting(false)} />
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 text-sm text-accent"
          >
            Decide later on the hand screen
          </button>
        </div>
      ) : (
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="min-h-12 rounded-[10px] border border-accent bg-[#0f2230] px-7 font-display text-[15px] font-semibold tracking-wider text-foreground"
        >
          {card.status === "pending" ? "BACK TO QUESTS" : "ADD TO HAND"}
        </button>
      )}
      </div>
    </div>
  );
}
