import { PROOF_INFO, type ProofType } from "@/lib/game/proof";
import { STAT_INFO } from "@/lib/game/stats";
import { tierForRank, type CardTier } from "@/lib/game/tiers";
import type { Quest } from "@/lib/supabase/quests";

// Shared pieces of a quest card, matching the prototype: the type chip, the
// proof it accepts, the title, the stat gain and the card tier it pays.

const TYPE_STYLE: Record<Quest["type"], string> = {
  daily: "border-accent text-accent",
  main: "border-gold text-gold",
  side: "border-muted text-muted",
  skill: "border-tier-platinum text-tier-platinum",
  placement: "border-tier-silver text-tier-silver",
};

export const TIER_TEXT: Record<CardTier, string> = {
  Bronze: "text-tier-bronze",
  Silver: "text-tier-silver",
  Gold: "text-tier-gold",
  Platinum: "text-tier-platinum",
  Diamond: "text-tier-diamond",
  Master: "text-tier-diamond",
  Challenger: "text-tier-diamond",
};

function proofLabel(quest: Quest): string {
  const names = (["evidence", "honour"] as ProofType[])
    .filter((p) => quest.allowedProofs.includes(p))
    .map((p) => PROOF_INFO[p].name);
  return names.length > 1 ? `${names.join(" or ")} proof` : `${names[0]} proof only`;
}

export function QuestHeader({ quest }: { quest: Quest }) {
  const tier = tierForRank(quest.rank);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wider ${TYPE_STYLE[quest.type]}`}
        >
          {quest.type.toUpperCase()}
          {quest.source === "user" && " · YOURS"}
        </span>
        <span className="text-xs text-muted">
          Rank {quest.rank} · {proofLabel(quest)}
        </span>
      </div>
      <p className="text-[15px] font-semibold leading-snug">{quest.title}</p>
      <div className="flex justify-between text-[13px]">
        <span className="text-accent">
          +{quest.gain} {STAT_INFO[quest.stat].name}
        </span>
        <span className={TIER_TEXT[tier]}>{tier} card</span>
      </div>
    </>
  );
}
