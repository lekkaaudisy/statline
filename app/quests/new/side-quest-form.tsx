"use client";

import { useState, useTransition } from "react";
import {
  USER_QUEST_TITLE_MAX_LENGTH,
  USER_SIDE_QUEST_MAX_RANK,
} from "@/lib/game/constants";
import { questGain } from "@/lib/game/difficulty";
import { EARNED_STATS, STAT_INFO, type EarnedStat } from "@/lib/game/stats";
import { tierForRank } from "@/lib/game/tiers";
import { createSideQuest } from "../actions";
import { TIER_TEXT } from "../quest-view";

const RANKS = Array.from({ length: USER_SIDE_QUEST_MAX_RANK }, (_, i) => i + 1);

const choiceClass = (selected: boolean) =>
  `flex min-h-11 flex-col items-center justify-center rounded-[10px] border px-2 py-2 text-sm ${
    selected ? "border-accent bg-accent/10" : "border-line"
  }`;

export function SideQuestForm() {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [stat, setStat] = useState<EarnedStat | null>(null);
  const [rank, setRank] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSideQuest({ title, stat, rank });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm text-muted">
        What will you do?
        <input
          value={title}
          maxLength={USER_QUEST_TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fix the bike chain"
          className="min-h-11 rounded-md border border-accent/30 bg-background px-3 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <span className="text-xs">
          Activity and skill only: no weight, food or body-size goals.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-muted">Which stat does it train?</legend>
        <div className="grid grid-cols-2 gap-2">
          {EARNED_STATS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stat === s}
              onClick={() => setStat(s)}
              className={choiceClass(stat === s)}
            >
              <span className="font-semibold">{STAT_INFO[s].name}</span>
              <span className="text-xs text-muted">{STAT_INFO[s].meaning}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-muted">How hard is it?</legend>
        <div className="grid grid-cols-3 gap-2">
          {RANKS.map((r) => {
            const tier = tierForRank(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={rank === r}
                onClick={() => setRank(r)}
                className={choiceClass(rank === r)}
              >
                <span className="font-semibold">Rank {r}</span>
                <span className="text-xs text-accent">+{questGain(r, "side")} pts</span>
                <span className={`text-xs ${TIER_TEXT[tier]}`}>{tier}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Your own side quests go up to rank {USER_SIDE_QUEST_MAX_RANK}. They are due by Sunday.
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-[15px] font-semibold tracking-wider text-foreground disabled:opacity-40"
      >
        {pending ? "CREATING" : "CREATE SIDE QUEST"}
      </button>
    </form>
  );
}
