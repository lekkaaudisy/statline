// Building quests from the Class, goal, daily time and weakest stat.
//
// - Daily quests: 1 to 3 a day (by daily time). The first always targets
//   the weakest stat, the others the next weakest stats.
// - Each quest comes from the Class library or the shared balance pool,
//   whichever keeps the week near 60% Class / 40% other stats.
// - One optional System side quest a day, on a stat not trained yet today.
// - One main quest a week, built from the goal.
// - Strength safety: one strength quest a day, capped minutes.
import type { ClassId } from "./classes";
import {
  CLASS_QUEST_SHARE,
  DAILY_QUESTS_BY_MINUTES,
  MAIN_QUEST_SESSIONS_BY_RANK,
  RECENT_TEMPLATE_DAYS,
  SECOND_CLASS_SHARE,
  STRENGTH_DAILIES_PER_DAY,
  STRENGTH_MAX_DAYS_PER_WEEK,
  SYSTEM_SIDE_QUESTS_PER_DAY,
  USER_QUEST_TITLE_MAX_LENGTH,
  USER_QUEST_TITLE_MIN_LENGTH,
  USER_SIDE_QUEST_MAX_RANK,
  USER_SIDE_QUESTS_PER_DAY,
} from "./constants";
import { addDays, daysBetween, weekStart } from "./dates";
import {
  effortMinutes,
  isValidRank,
  questGain,
  rankFor,
  type QuestType,
} from "./difficulty";
import { allowedProofs, type SelectableProof } from "./proof";
import {
  BALANCE_TEMPLATES,
  CLASS_TEMPLATES,
  fillTitle,
  MAIN_TEMPLATES,
  usesMinutes,
  type QuestTemplate,
} from "./quest-templates";
import { pick, seededRandom, type Random } from "./random";
import { isSafeGoalText } from "./safety";
import { EARNED_STATS, type EarnedStat } from "./stats";

export type DailyMinutes = keyof typeof DAILY_QUESTS_BY_MINUTES;

// A quest ready to be saved.
export type QuestDraft = {
  type: Exclude<QuestType, "skill" | "placement">;
  templateId: string;
  title: string;
  stat: EarnedStat;
  rank: number;
  gain: number;
  minutes: number | null;
  countsForClass: boolean;
  allowedProofs: SelectableProof[];
  issuedOn: string;
  dueOn: string;
  slot: number;
};

// A quest already saved, as far as building new quests needs to know.
export type ExistingQuest = {
  type: QuestType;
  source: "system" | "user";
  issuedOn: string;
  templateId: string | null;
  countsForClass: boolean;
};

export type Player = {
  mainClass: ClassId;
  secondClass: ClassId | null;
  goal: string;
  dailyMinutes: DailyMinutes;
  // Difficulty rank for daily quests (1 to 5).
  rank: number;
  // Each earned stat's points (after decay).
  points: Record<EarnedStat, number>;
};

// Running count of this week's System quests, for the 60/40 rule.
export type Tally = { classQuests: number; otherQuests: number };

// Stats from weakest to strongest. Ties keep the usual stat order.
export function statsByWeakness(points: Record<EarnedStat, number>): EarnedStat[] {
  return [...EARNED_STATS].sort((a, b) => points[a] - points[b]);
}

export function weakestStat(points: Record<EarnedStat, number>): EarnedStat {
  return statsByWeakness(points)[0];
}

// Whether the next quest should come from the Class: whichever choice leaves
// the share closer to 60% (a tie goes to the Class).
export function nextIsClassQuest(tally: Tally): boolean {
  const total = tally.classQuests + tally.otherQuests + 1;
  const ifClass = Math.abs((tally.classQuests + 1) / total - CLASS_QUEST_SHARE);
  const ifOther = Math.abs(tally.classQuests / total - CLASS_QUEST_SHARE);
  return ifClass <= ifOther;
}

export function classShare(quests: readonly { countsForClass: boolean }[]): number {
  if (quests.length === 0) return 0;
  return quests.filter((q) => q.countsForClass).length / quests.length;
}

type Choice = { template: QuestTemplate; countsForClass: boolean };

// Templates not used recently, or all of them if every one was.
function fresh(templates: readonly QuestTemplate[], avoid: ReadonlySet<string>) {
  const unused = templates.filter((t) => !avoid.has(t.id));
  return unused.length > 0 ? unused : templates;
}

// The Class templates to draw from: the second Class about a third of the
// time, falling back to the other Class if a pool has nothing that fits.
function classCandidates(
  player: Player,
  fits: (t: QuestTemplate) => boolean,
  random: Random,
): QuestTemplate[] {
  const main = CLASS_TEMPLATES[player.mainClass].filter(fits);
  if (!player.secondClass) return main;
  const second = CLASS_TEMPLATES[player.secondClass].filter(fits);
  const useSecond = random() < SECOND_CLASS_SHARE;
  const first = useSecond ? second : main;
  return first.length > 0 ? first : useSecond ? main : second;
}

// Picks a template for one quest. `targets` are the stats to aim at, best
// first. Class quests may train any allowed stat (the target when the slot
// must hit it); balance quests always train the first target.
function choose(
  player: Player,
  tally: Tally,
  targets: readonly EarnedStat[],
  mustHitTarget: boolean,
  avoid: ReadonlySet<string>,
  random: Random,
): Choice {
  const target = targets[0];
  if (nextIsClassQuest(tally)) {
    const allowed = mustHitTarget ? [target] : targets;
    const candidates = classCandidates(player, (t) => allowed.includes(t.stat), random);
    if (candidates.length > 0) {
      // Prefer the weakest stat the Class can train.
      const best = candidates.filter(
        (t) => t.stat === allowed.find((s) => candidates.some((c) => c.stat === s)),
      );
      return { template: pick(fresh(best, avoid), random), countsForClass: true };
    }
  }
  const balance = BALANCE_TEMPLATES.filter((t) => t.stat === target);
  return { template: pick(fresh(balance, avoid), random), countsForClass: false };
}

function draft(
  choice: Choice,
  type: "daily" | "side",
  player: Player,
  available: number,
  today: string,
  slot: number,
): QuestDraft {
  const { template, countsForClass } = choice;
  const rank = rankFor(type, player.rank);
  const minutes = usesMinutes(template)
    ? effortMinutes(available, rank, template.stat, player.dailyMinutes)
    : null;
  return {
    type,
    templateId: template.id,
    title: fillTitle(template.title, { minutes: minutes ?? undefined }),
    stat: template.stat,
    rank,
    gain: questGain(rank, type),
    minutes,
    countsForClass,
    allowedProofs: allowedProofs(rank),
    issuedOn: today,
    dueOn: today,
    slot,
  };
}

function count(tally: Tally, choice: { countsForClass: boolean }) {
  if (choice.countsForClass) tally.classQuests += 1;
  else tally.otherQuests += 1;
}

// Today's daily quests (none on the rest day) and the optional System side
// quest. Updates `tally` as it goes. On a calibration day, today's placement
// quest takes one daily quest's place and counts as today's stat for it.
export function generateDayQuests(
  player: Player,
  today: string,
  tally: Tally,
  avoid: ReadonlySet<string>,
  random: Random,
  restDay: boolean,
  placementStat: EarnedStat | null = null,
): QuestDraft[] {
  const dailyCount = DAILY_QUESTS_BY_MINUTES[player.dailyMinutes];
  const available = player.dailyMinutes / dailyCount;
  const order = statsByWeakness(player.points);
  const used = new Set(avoid);
  const statsToday: EarnedStat[] = placementStat ? [placementStat] : [];
  const dailiesToday = placementStat ? dailyCount - 1 : dailyCount;
  const quests: QuestDraft[] = [];

  function targets(): EarnedStat[] {
    const strengthFull =
      statsToday.filter((s) => s === "strength").length >= STRENGTH_DAILIES_PER_DAY;
    const allowed = order.filter((s) => !(strengthFull && s === "strength"));
    const untouched = allowed.filter((s) => !statsToday.includes(s));
    return untouched.length > 0 ? untouched : allowed;
  }

  function add(type: "daily" | "side", slot: number, mustHitTarget: boolean) {
    const choice = choose(player, tally, targets(), mustHitTarget, used, random);
    const quest = draft(choice, type, player, available, today, slot);
    quests.push(quest);
    used.add(quest.templateId);
    statsToday.push(quest.stat);
    count(tally, choice);
  }

  if (!restDay) {
    for (let slot = 1; slot <= dailiesToday; slot++) add("daily", slot, slot === 1);
  }
  for (let slot = 1; slot <= SYSTEM_SIDE_QUESTS_PER_DAY; slot++) add("side", slot, true);
  return quests;
}

// This week's main quest, built from the goal and the main Class.
export function generateMainQuest(
  player: Player,
  today: string,
  random: Random,
): QuestDraft {
  const template = pick(MAIN_TEMPLATES[player.mainClass], random);
  const rank = rankFor("main", player.rank);
  let sessions: number = MAIN_QUEST_SESSIONS_BY_RANK[rank - 1];
  if (template.stat === "strength") {
    sessions = Math.min(sessions, STRENGTH_MAX_DAYS_PER_WEEK);
  }
  const minutes = effortMinutes(
    player.dailyMinutes,
    rank,
    template.stat,
    player.dailyMinutes,
  );
  const monday = weekStart(today);
  return {
    type: "main",
    templateId: template.id,
    title: fillTitle(template.title, { minutes, sessions, goal: player.goal }),
    stat: template.stat,
    rank,
    gain: questGain(rank, "main"),
    minutes,
    countsForClass: true,
    allowedProofs: allowedProofs(rank),
    issuedOn: monday,
    dueOn: addDays(monday, 6),
    slot: 1,
  };
}

// Everything the System still owes the user today: the week's main quest if
// it has not been issued, and today's daily and side quests if they have
// not. `seed` (the user id) makes the choice the same every time.
// `placementStat` is the stat of today's placement quest, in the
// calibration week.
export function planQuests(input: {
  seed: string;
  today: string;
  player: Player;
  existing: readonly ExistingQuest[];
  restDay: boolean;
  placementStat?: EarnedStat | null;
}): QuestDraft[] {
  const { seed, today, player, existing, restDay, placementStat = null } = input;
  const monday = weekStart(today);
  const system = existing.filter((q) => q.source === "system");
  const thisWeek = system.filter((q) => q.issuedOn >= monday);
  const tally: Tally = { classQuests: 0, otherQuests: 0 };
  thisWeek.forEach((q) => count(tally, q));

  const quests: QuestDraft[] = [];
  if (!thisWeek.some((q) => q.type === "main")) {
    const main = generateMainQuest(player, today, seededRandom(`${seed}:${monday}:main`));
    quests.push(main);
    count(tally, main);
  }

  const issuedToday = system.some(
    (q) => q.issuedOn === today && (q.type === "daily" || q.type === "side"),
  );
  if (!issuedToday) {
    const avoid = new Set(
      system
        .filter((q) => {
          const age = daysBetween(q.issuedOn, today);
          return age > 0 && age <= RECENT_TEMPLATE_DAYS;
        })
        .flatMap((q) => (q.templateId ? [q.templateId] : [])),
    );
    quests.push(
      ...generateDayQuests(
        player,
        today,
        tally,
        avoid,
        seededRandom(`${seed}:${today}`),
        restDay,
        placementStat,
      ),
    );
  }
  return quests;
}

// A side quest the user makes. Checked here before it is saved.
export type SideQuestInput = { title: string; stat: EarnedStat; rank: number };

export function validateSideQuest(
  input: unknown,
):
  | { ok: true; value: SideQuestInput }
  | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const { title, stat, rank } = input as Record<string, unknown>;
  if (typeof title !== "string") return { ok: false, error: "Give your quest a title." };
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (trimmed.length < USER_QUEST_TITLE_MIN_LENGTH) {
    return { ok: false, error: "Give your quest a title." };
  }
  if (trimmed.length > USER_QUEST_TITLE_MAX_LENGTH) {
    return { ok: false, error: `Keep the title to ${USER_QUEST_TITLE_MAX_LENGTH} characters or fewer.` };
  }
  if (!isSafeGoalText(trimmed)) {
    return {
      ok: false,
      error: "Quests are about activity and skill, not weight, food or body size. Try something you want to do or learn.",
    };
  }
  if (!EARNED_STATS.includes(stat as EarnedStat)) {
    return { ok: false, error: "Choose the stat this quest trains." };
  }
  if (!isValidRank(rank) || rank > USER_SIDE_QUEST_MAX_RANK) {
    return { ok: false, error: `Choose a rank from 1 to ${USER_SIDE_QUEST_MAX_RANK}.` };
  }
  return { ok: true, value: { title: trimmed, stat: stat as EarnedStat, rank } };
}

// Users can make a few side quests a day.
export function canCreateSideQuest(createdToday: number): boolean {
  return createdToday < USER_SIDE_QUESTS_PER_DAY;
}
