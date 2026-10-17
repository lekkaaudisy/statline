"use client";

import { useState, useTransition } from "react";
import { CREW_NAME_MAX_LENGTH, INVITE_CODE_LENGTH } from "@/lib/game/constants";
import { createCrew, joinCrew, type CrewActionResult } from "./actions";

const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-background px-3 text-base text-foreground placeholder:text-muted";
const buttonClass =
  "min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-sm font-semibold tracking-wider text-accent disabled:opacity-50";

// Shown when the user has no crew: start one, or join with a code.
export function CrewSetup() {
  const [busy, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<CrewActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-sm tracking-[0.15em] text-accent">CREW</h1>
        <p className="text-sm leading-normal text-muted">
          A crew is a small group of friends (up to 30). Crewmates confirm each
          other&apos;s quests, gift cards, and compete on a weekly leaderboard
          for effort. They only ever see your letter grades, never your points.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-[10px] border border-gold/60 px-3.5 py-3 text-sm text-gold">
          {error}
        </p>
      )}

      <form
        className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => joinCrew(code));
        }}
      >
        <label htmlFor="invite-code" className="font-display text-sm tracking-[0.15em] text-accent">
          JOIN WITH A CODE
        </label>
        <input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. K7QM2X"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={INVITE_CODE_LENGTH + 4}
          className={`${inputClass} font-display tracking-[0.3em] uppercase`}
        />
        <button type="submit" disabled={busy || !code.trim()} className={buttonClass}>
          JOIN CREW
        </button>
      </form>

      <form
        className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createCrew(name));
        }}
      >
        <label htmlFor="crew-name" className="font-display text-sm tracking-[0.15em] text-accent">
          START A CREW
        </label>
        <input
          id="crew-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Crew name"
          maxLength={CREW_NAME_MAX_LENGTH}
          className={inputClass}
        />
        <button type="submit" disabled={busy || !name.trim()} className={buttonClass}>
          CREATE CREW
        </button>
      </form>
    </div>
  );
}
