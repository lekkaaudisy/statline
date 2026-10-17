// The five stats and the grade ladder. Names only: the numbers that go with
// them live in constants.ts.

export const STATS = [
  "strength",
  "speed",
  "endurance",
  "intelligence",
  "potential",
] as const;
export type Stat = (typeof STATS)[number];

// Potential is never earned directly, so it is left out of anything that
// scores effort (onboarding answers, quests).
export const EARNED_STATS = [
  "strength",
  "speed",
  "endurance",
  "intelligence",
] as const satisfies readonly Stat[];
export type EarnedStat = (typeof EARNED_STATS)[number];

export const STAT_INFO: Record<Stat, { name: string; meaning: string }> = {
  strength: { name: "Strength", meaning: "Physical capability" },
  speed: { name: "Speed", meaning: "Planned tasks done on time" },
  endurance: { name: "Endurance", meaning: "Consistency and recovery" },
  intelligence: { name: "Intelligence", meaning: "Learning and skill" },
  potential: { name: "Potential", meaning: "Momentum" },
};

// The Human range shown in the MVP, lowest first.
export const GRADES = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"] as const;
export type Grade = (typeof GRADES)[number];
