// Safety rules from CLAUDE.md: no calorie targets, weight-loss goals, fasting
// or body-size goals. This catches the common wordings in text the user
// writes. It is a first filter, not a guarantee, so quest building must still
// follow the safety rules on its own.

const UNSAFE_PATTERNS: readonly RegExp[] = [
  /\bcalor(ie|ies|ic)\b/i,
  /\bkcals?\b/i,
  /\bbmi\b/i,
  /\bfasting\b/i,
  /\bintermittent fast/i,
  /\bfast for \d+\s*(hours?|days?)\b/i,
  /\bskip(ping)? (meals|breakfast|lunch|dinner)\b/i,
  /\bdiet(s|ing)?\b/i,
  /\bweight[- ]?loss\b/i,
  /\b(lose|lost|losing|drop|dropping|shed|shedding|cut|cutting|gain|gaining)\b.{0,30}\b(weight|kgs?|kilos?|lbs?|pounds?|stones?|fat|inches|sizes?)\b/i,
  /\bweigh(ing)?\b.{0,15}\b(under|less|below|\d)/i,
  /\b(body|belly|stomach)[- ]?fat\b/i,
  /\bburn(ing)?\b.{0,15}\bfat\b/i,
  /\b(skinny|skinnier|thinner|slimmer|slim down)\b/i,
  /\b(waist|dress sizes?|clothes sizes?|thigh gap|bikini body)\b/i,
];

export function isSafeGoalText(text: string): boolean {
  return !UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}
