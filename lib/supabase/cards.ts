import type { Card, CardKind, CardStatus } from "@/lib/game/cards";
import type { Treats } from "@/lib/game/rewards";
import type { CardTier } from "@/lib/game/tiers";
import type { createClient } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const CARD_COLUMNS =
  "id, kind, tier, status, treat, questline_id, questline_length, questline_step, activated_on, created_at";

type CardRow = {
  id: string;
  kind: CardKind;
  tier: CardTier;
  status: CardStatus;
  treat: string | null;
  questline_id: string | null;
  questline_length: number | null;
  questline_step: number;
  activated_on: string | null;
  created_at: string;
};

export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    kind: row.kind,
    tier: row.tier,
    status: row.status,
    treat: row.treat,
    questlineId: row.questline_id,
    questlineLength: row.questline_length,
    questlineStep: row.questline_step,
    activatedOn: row.activated_on,
    createdAt: row.created_at,
  };
}

// The cards that still matter: waiting, held and in play, plus finished
// Skill cards (so a questline is never offered twice). Oldest first.
export async function loadCards(supabase: Client): Promise<Card[]> {
  const { data } = await supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .or("status.in.(pending,held,active),and(kind.eq.skill,status.eq.used)")
    .order("created_at", { ascending: true });
  return ((data ?? []) as CardRow[]).map(toCard);
}

export async function loadTreats(supabase: Client): Promise<Treats> {
  const { data } = await supabase.from("reward_settings").select("tier, treat");
  const rows = (data ?? []) as { tier: CardTier; treat: string }[];
  return Object.fromEntries(rows.map((r) => [r.tier, r.treat]));
}

// The user's Day One or Exclusive Proof card, if they have it.
export async function loadProofCard(
  supabase: Client,
  kind: "day_one" | "exclusive",
): Promise<Card | null> {
  const { data } = await supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("kind", kind)
    .maybeSingle();
  return data ? toCard(data as CardRow) : null;
}
