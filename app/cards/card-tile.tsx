import type { ReactNode } from "react";
import type { CardTier } from "@/lib/game/tiers";
import type { CardView } from "./card-view";

// Tier colours (CLAUDE.md "Look and feel"). Diamond and above share the
// placeholder Diamond colour until they get their own.
export const TIER_STYLE: Record<CardTier, { text: string; border: string; bar: string }> = {
  Bronze: { text: "text-tier-bronze", border: "border-tier-bronze", bar: "bg-tier-bronze" },
  Silver: { text: "text-tier-silver", border: "border-tier-silver", bar: "bg-tier-silver" },
  Gold: { text: "text-tier-gold", border: "border-tier-gold", bar: "bg-tier-gold" },
  Platinum: { text: "text-tier-platinum", border: "border-tier-platinum", bar: "bg-tier-platinum" },
  Diamond: { text: "text-tier-diamond", border: "border-tier-diamond", bar: "bg-tier-diamond" },
  Master: { text: "text-tier-diamond", border: "border-tier-diamond", bar: "bg-tier-diamond" },
  Challenger: { text: "text-tier-diamond", border: "border-tier-diamond", bar: "bg-tier-diamond" },
};

// One card, as in the prototype: a tier-coloured frame and bar, the tier
// and family, the name, what it does, and room for its buttons.
export function CardTile({
  card,
  size = "small",
  children,
}: {
  card: CardView;
  size?: "small" | "large";
  children?: ReactNode;
}) {
  const style = TIER_STYLE[card.tier];
  const large = size === "large";
  return (
    <article
      className={`flex flex-col bg-panel ${style.border} ${
        large ? "w-[230px] gap-2.5 rounded-2xl border-2 p-5" : "gap-2 rounded-xl border p-3.5"
      }`}
    >
      <div className={`rounded-sm ${style.bar} ${large ? "h-1.5" : "h-1"}`} />
      <span className={`font-semibold tracking-wider ${style.text} ${large ? "text-xs" : "text-[11px]"}`}>
        {card.tier} · {card.family}
        {large && " card"}
      </span>
      <span className={`font-display font-bold leading-tight ${large ? "text-2xl" : "text-[17px]"}`}>
        {card.name}
      </span>
      <span className={`flex-1 leading-normal text-[#c3cedb] ${large ? "text-[13px]" : "text-xs"}`}>
        {card.effect}
      </span>
      {children}
    </article>
  );
}
