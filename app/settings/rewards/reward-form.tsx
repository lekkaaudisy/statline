"use client";

import { useState, useTransition } from "react";
import { REWARD_TREAT_MAX_LENGTH } from "@/lib/game/constants";
import type { CardTier } from "@/lib/game/tiers";
import { TIER_STYLE } from "../../cards/card-tile";
import { saveTreats } from "./actions";

type Row = { tier: CardTier; treat: string; example: string };

export function RewardForm({ tiers }: { tiers: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(tiers.map((t) => [t.tier, t.treat])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveTreats(values);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {tiers.map(({ tier, example }) => (
        <label key={tier} className={`flex flex-col gap-2 rounded-xl border bg-panel p-4 ${TIER_STYLE[tier].border}`}>
          <span className={`font-display text-sm font-semibold tracking-wider ${TIER_STYLE[tier].text}`}>
            {tier.toUpperCase()}
          </span>
          <input
            type="text"
            value={values[tier] ?? ""}
            maxLength={REWARD_TREAT_MAX_LENGTH}
            placeholder={`For example: ${example}`}
            onChange={(e) => setValues({ ...values, [tier]: e.target.value })}
            className="min-h-11 rounded-md border border-accent/30 bg-background px-3 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-accent">
          Treats saved.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-[15px] font-semibold tracking-wider text-foreground disabled:opacity-40"
      >
        {pending ? "SAVING" : "SAVE TREATS"}
      </button>
    </form>
  );
}
