// Reward treats: the user sets one treat per card tier in advance, and a
// Reward card of that tier redeems it. Treats follow the safety rules too.
import { REWARD_TREAT_MAX_LENGTH, REWARD_TREAT_MIN_LENGTH } from "./constants";
import { isSafeGoalText } from "./safety";
import { CARD_TIERS, type CardTier } from "./tiers";

// Tiers a quest can pay out in the MVP (ranks 1 to 5).
export const REWARD_TIERS = CARD_TIERS.slice(0, 5) as readonly CardTier[];

export type Treats = Partial<Record<CardTier, string>>;

export const TREAT_EXAMPLES: Record<string, string> = {
  Bronze: "An episode of a favourite show",
  Silver: "A guilt-free game night",
  Gold: "A coffee out with a friend",
  Platinum: "A new book",
  Diamond: "A day trip somewhere new",
};

// Checks the treats from the settings form. Empty means "no treat for this
// tier". Returns the clean treats, or the first error.
export function validateTreats(
  input: unknown,
): { ok: true; value: Treats } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const raw = input as Record<string, unknown>;
  const value: Treats = {};
  for (const tier of REWARD_TIERS) {
    const text = raw[tier];
    if (text === undefined || text === null) continue;
    if (typeof text !== "string") return { ok: false, error: "Something went wrong. Please try again." };
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) continue;
    if (clean.length < REWARD_TREAT_MIN_LENGTH) {
      return { ok: false, error: `${tier}: write at least ${REWARD_TREAT_MIN_LENGTH} characters.` };
    }
    if (clean.length > REWARD_TREAT_MAX_LENGTH) {
      return { ok: false, error: `${tier}: keep it to ${REWARD_TREAT_MAX_LENGTH} characters or fewer.` };
    }
    if (!isSafeGoalText(clean)) {
      return {
        ok: false,
        error: `${tier}: treats can't be about weight, dieting or body size. Pick something you enjoy doing.`,
      };
    }
    value[tier] = clean;
  }
  return { ok: true, value };
}
