"use client";

import { useState, useTransition } from "react";
import { newInviteCode } from "./actions";

const smallButton =
  "min-h-11 rounded-lg border border-[#3a4d69] bg-[#18222f] px-3 text-[13px] font-semibold text-foreground disabled:opacity-50";

// The crew's invite code, with Share (or Copy) and, for the owner, a button
// to replace it.
export function InviteCode({ code, crewName, owner }: { code: string; crewName: string; owner: boolean }) {
  const [busy, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const text = `Join my Statline crew "${crewName}" with the invite code ${code}.`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(code);
      setNote("Code copied.");
    } catch {
      // The user closed the share sheet, or copying is blocked.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">Invite code</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-2xl font-bold tracking-[0.3em] text-accent">{code}</span>
        <button type="button" className={smallButton} onClick={share}>
          Share
        </button>
        {owner && (
          <button
            type="button"
            disabled={busy}
            className={smallButton}
            onClick={() =>
              startTransition(async () => {
                const result = await newInviteCode();
                setNote(result.error ?? result.message ?? null);
              })
            }
          >
            New code
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
