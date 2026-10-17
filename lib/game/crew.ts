// Crew-lite: crew names, invite codes, which cards can be gifted, the
// confirmation window, and the weekly contribution leaderboard.
//
// The leaderboard ranks effort for the crew (quests cleared, crewmates'
// proofs confirmed, cards gifted). It never uses raw stats or grades.
import type { CardKind, CardStatus } from "./cards";
import {
  CONTRIBUTION_POINTS,
  CREW_CONFIRM_WINDOW_DAYS,
  CREW_MAX_MEMBERS,
  CREW_NAME_MAX_LENGTH,
  CREW_NAME_MIN_LENGTH,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  WEEKLY_CONFIRMATIONS_COUNTED,
  WEEKLY_GIFTS_COUNTED,
} from "./constants";
import { daysBetween } from "./dates";
import { crewTopUp, proofPoints, type ProofType } from "./proof";

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

// Trims a crew name and checks its length.
export function validateCrewName(input: unknown): Validated<string> {
  const name = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (name.length < CREW_NAME_MIN_LENGTH || name.length > CREW_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Crew names are ${CREW_NAME_MIN_LENGTH} to ${CREW_NAME_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: name };
}

// Tidies a typed invite code (any case, spaces and dashes ignored). Returns
// null if it cannot be a real code.
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== INVITE_CODE_LENGTH) return null;
  return [...code].every((ch) => INVITE_CODE_ALPHABET.includes(ch)) ? code : null;
}

export function crewIsFull(memberCount: number): boolean {
  return memberCount >= CREW_MAX_MEMBERS;
}

// Only System cards can be gifted: Reward cards are the giver's own treat,
// Skill cards are tied to their questlines, and Proof cards are never traded.
export const GIFTABLE_KINDS = ["reroll", "rest", "double_xp", "shield"] as const satisfies readonly CardKind[];

export type GiftableCard = { kind: CardKind; status: CardStatus; giftedBy: string | null };

// Why this card cannot be gifted, or null if it can.
export function giftError(card: GiftableCard): string | null {
  if (!(GIFTABLE_KINDS as readonly CardKind[]).includes(card.kind)) {
    return "Only System cards can be gifted.";
  }
  if (card.status !== "held") return "Only cards in your hand can be gifted.";
  if (card.giftedBy !== null) return "A gifted card can't be passed on.";
  return null;
}

// Whether a quest cleared on `clearedOn` can still be confirmed by the crew.
export function confirmWindowOpen(clearedOn: string, today: string): boolean {
  const days = daysBetween(clearedOn, today);
  return days >= 0 && days <= CREW_CONFIRM_WINDOW_DAYS;
}

// The extra points a crewmate's confirmation gives this cleared quest. An
// award at least twice the proof's share means Double XP doubled it.
export function confirmationTopUp(quest: {
  gain: number;
  proofType: ProofType;
  pointsAwarded: number;
}): number {
  const base = proofPoints(quest.gain, quest.proofType);
  const doubled = base > 0 && quest.pointsAwarded >= 2 * base;
  return crewTopUp(quest.gain, quest.proofType, doubled);
}

export type WeekCounts = {
  questsCleared: number;
  proofsConfirmed: number;
  cardsGifted: number;
};

// Contribution points for one member's week. Confirmations and gifts count
// only up to their weekly caps.
export function contributionScore(counts: WeekCounts): number {
  const clean = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return (
    clean(counts.questsCleared) * CONTRIBUTION_POINTS.questCleared +
    Math.min(clean(counts.proofsConfirmed), WEEKLY_CONFIRMATIONS_COUNTED) *
      CONTRIBUTION_POINTS.proofConfirmed +
    Math.min(clean(counts.cardsGifted), WEEKLY_GIFTS_COUNTED) * CONTRIBUTION_POINTS.cardGifted
  );
}

export type LeaderboardEntry<T> = T & { score: number; rank: number };

// Highest score first. Equal scores share a rank (1, 1, 3) and are listed by
// name.
export function rankLeaderboard<T extends { name: string; counts: WeekCounts }>(
  members: readonly T[],
): LeaderboardEntry<T>[] {
  const scored = members
    .map((m) => ({ ...m, score: contributionScore(m.counts) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.map((m) => ({
    ...m,
    rank: scored.findIndex((other) => other.score === m.score) + 1,
  }));
}
