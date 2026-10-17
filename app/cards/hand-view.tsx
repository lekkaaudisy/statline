"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { CardTier } from "@/lib/game/tiers";
import { devGiveCards, discardCard, giftCard, playCard, type CardActionResult } from "./actions";
import { CardTile, TIER_STYLE } from "./card-tile";
import type { CardView } from "./card-view";
import { GiftCard, type Crewmate } from "./gift-card";
import { PendingChoice } from "./pending-choice";

export type InPlay = { id: string; tier: CardTier; title: string; detail: string };
type HandCard = CardView & { blocked: string | null; giftable: boolean };
type QuestOption = { id: string; title: string; type: string };

const buttonClass =
  "min-h-11 rounded-lg border border-[#3a4d69] bg-[#18222f] text-[13px] font-semibold text-foreground disabled:opacity-50";

function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-sm tracking-[0.15em] text-accent">{children}</h2>
      {aside && <span className="text-[13px] text-muted">{aside}</span>}
    </div>
  );
}

// The hand screen from the prototype: cards waiting for a full hand, cards in
// play, the hand itself (up to 10), and Proof cards kept apart.
export function HandView({
  hand,
  handSize,
  pending,
  proof,
  inPlay,
  rerollQuests,
  restCount,
  crewmates,
  devTester,
}: {
  hand: HandCard[];
  handSize: number;
  pending: CardView[];
  proof: CardView[];
  inPlay: InPlay[];
  rerollQuests: QuestOption[];
  restCount: number;
  crewmates: Crewmate[];
  devTester: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A card waiting for a second tap: Reroll (pick a quest), Rest, or discard.
  const [confirming, setConfirming] = useState<{ id: string; mode: "use" | "discard" | "gift" } | null>(null);
  const [rerollQuest, setRerollQuest] = useState<string | null>(null);

  function run(action: () => Promise<CardActionResult>) {
    setError(null);
    setToast(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else {
        setToast(result.message ?? null);
        setConfirming(null);
        setRerollQuest(null);
      }
    });
  }

  function use(card: HandCard) {
    if (card.kind === "reroll" || card.kind === "rest") {
      setConfirming({ id: card.id, mode: "use" });
      return;
    }
    run(() => playCard({ cardId: card.id }));
  }

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <p role="status" className="rounded-[10px] border border-accent bg-[#0f2230] px-3.5 py-3 text-sm leading-normal">
          {toast}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-[10px] border border-gold/60 px-3.5 py-3 text-sm text-gold">
          {error}
        </p>
      )}

      {pending.map((card) => (
        <section key={card.id} className="flex flex-col gap-3 rounded-xl border border-dashed border-gold/60 p-4">
          <CardTile card={card} />
          <PendingChoice card={card} hand={hand} onDone={(message) => setToast(message)} />
        </section>
      ))}

      {inPlay.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>IN PLAY</SectionTitle>
          {inPlay.map((item) => (
            <div key={item.id} className={`flex flex-col gap-1 rounded-xl border bg-panel p-4 ${TIER_STYLE[item.tier].border}`}>
              <span className="font-display text-[15px] font-semibold">{item.title}</span>
              <span className="text-[13px] leading-normal text-muted">{item.detail}</span>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle aside={`${hand.length} / ${handSize} cards`}>YOUR HAND</SectionTitle>
        {hand.length === 0 && (
          <p className="text-sm text-muted">No cards yet. Clear quests to earn them.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {hand.map((card) => {
            const open = confirming?.id === card.id;
            return (
              <CardTile key={card.id} card={card}>
                {open && confirming.mode === "use" && card.kind === "reroll" && (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1 text-xs text-muted">Quest to swap</legend>
                    {rerollQuests.map((q) => (
                      <label key={q.id} className="flex min-h-11 items-center gap-2 text-xs leading-snug">
                        <input
                          type="radio"
                          name={`reroll-${card.id}`}
                          checked={rerollQuest === q.id}
                          onChange={() => setRerollQuest(q.id)}
                          className="size-5 shrink-0 accent-[#5ed1f0]"
                        />
                        <span>
                          <span className="text-muted">{q.type.toUpperCase()} · </span>
                          {q.title}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {open && confirming.mode === "use" && card.kind === "rest" && (
                  <p className="text-xs text-muted">
                    Rest {restCount === 1 ? "today's open daily quest" : `today's ${restCount} open daily quests`}?
                  </p>
                )}
                {open && confirming.mode === "discard" && (
                  <p className="text-xs text-muted">Discard this card for good?</p>
                )}

                {open && confirming.mode === "gift" ? (
                  <GiftCard
                    cardId={card.id}
                    crewmates={crewmates}
                    busy={busy}
                    onCancel={() => setConfirming(null)}
                    onGift={(toUserId) => run(() => giftCard({ cardId: card.id, toUserId }))}
                  />
                ) : open ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={buttonClass} onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy || (confirming.mode === "use" && card.kind === "reroll" && !rerollQuest)}
                      className={`${buttonClass} border-accent`}
                      onClick={() =>
                        run(() =>
                          confirming.mode === "discard"
                            ? discardCard(card.id)
                            : playCard({ cardId: card.id, questId: rerollQuest }),
                        )
                      }
                    >
                      {confirming.mode === "discard" ? "Discard" : "Confirm"}
                    </button>
                  </div>
                ) : (
                  <>
                    {card.blocked && <span className="text-xs leading-snug text-muted">{card.blocked}</span>}
                    <button
                      type="button"
                      disabled={busy || Boolean(card.blocked)}
                      className={buttonClass}
                      onClick={() => use(card)}
                    >
                      {card.action}
                    </button>
                    {card.giftable && crewmates.length > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        className={buttonClass}
                        onClick={() => setConfirming({ id: card.id, mode: "gift" })}
                      >
                        Gift to crewmate
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-11 text-xs text-muted"
                      onClick={() => setConfirming({ id: card.id, mode: "discard" })}
                    >
                      Discard
                    </button>
                  </>
                )}
              </CardTile>
            );
          })}
        </div>
        <Link
          href="/settings/rewards"
          className="flex min-h-11 items-center justify-center rounded-[10px] border border-dashed border-line font-display text-sm font-semibold tracking-wider text-accent"
        >
          SET YOUR REWARD TREATS
        </Link>
      </section>

      {proof.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle aside="Kept forever">PROOF CARDS</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {proof.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
          <p className="text-xs text-muted">
            Proof cards never count toward your hand and can&apos;t be used, traded or discarded.
          </p>
        </section>
      )}

      <p className="text-xs leading-normal text-muted">
        Cards are earned by clearing quests. They can never be bought.
      </p>

      {devTester && (
        <section aria-label="Developer tools" className="rounded-[14px] border border-dashed border-gold/60 p-4">
          <p className="font-display text-sm tracking-[0.15em] text-gold">DEVELOPER TOOLS</p>
          <button
            type="button"
            disabled={busy}
            className="mt-3 min-h-11 w-full rounded-md border border-line bg-track px-2 text-sm font-medium text-foreground disabled:opacity-50"
            onClick={() => run(devGiveCards)}
          >
            Give one of each card (Silver)
          </button>
        </section>
      )}
    </div>
  );
}
