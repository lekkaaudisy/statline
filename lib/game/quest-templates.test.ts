import { describe, expect, it } from "vitest";
import { CLASSES } from "./classes";
import { GOAL_MAX_LENGTH, QUEST_TITLE_MAX_LENGTH } from "./constants";
import {
  BALANCE_TEMPLATES,
  CLASS_MAIN_STAT,
  CLASS_TEMPLATES,
  fillTitle,
  MAIN_TEMPLATES,
  type QuestTemplate,
} from "./quest-templates";
import { isSafeGoalText } from "./safety";
import { EARNED_STATS } from "./stats";

const ALL: QuestTemplate[] = [
  ...CLASSES.flatMap((c) => [...CLASS_TEMPLATES[c], ...MAIN_TEMPLATES[c]]),
  ...BALANCE_TEMPLATES,
];

// Words that would mean scoring a virtue, which Statline never does.
const VIRTUE_WORDS = /\b(kind|kindness|patient|patience|generous|honest|humble|grateful)\b/i;

describe("quest templates", () => {
  it("has at least 10 daily templates per Class", () => {
    for (const c of CLASSES) {
      expect(CLASS_TEMPLATES[c].length).toBeGreaterThanOrEqual(10);
    }
  });

  it("covers every earned stat in every Class and in the balance pool", () => {
    for (const c of CLASSES) {
      const stats = new Set(CLASS_TEMPLATES[c].map((t) => t.stat));
      expect(stats).toEqual(new Set(EARNED_STATS));
    }
    for (const stat of EARNED_STATS) {
      expect(BALANCE_TEMPLATES.filter((t) => t.stat === stat).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every Class two main quests on its main stat", () => {
    for (const c of CLASSES) {
      expect(MAIN_TEMPLATES[c]).toHaveLength(2);
      for (const t of MAIN_TEMPLATES[c]) {
        expect(t.stat).toBe(CLASS_MAIN_STAT[c]);
        expect(t.title).toContain("{goal}");
        expect(t.title).toContain("{sessions}");
      }
    }
  });

  it("uses unique ids", () => {
    expect(new Set(ALL.map((t) => t.id)).size).toBe(ALL.length);
  });

  it("never uses Potential, which is not earned directly", () => {
    for (const t of ALL) expect(EARNED_STATS).toContain(t.stat);
  });

  it("follows the safety rules: no calories, weight, fasting or body size", () => {
    for (const t of ALL) expect(isSafeGoalText(t.title), t.id).toBe(true);
  });

  it("never scores a virtue", () => {
    for (const t of ALL) expect(VIRTUE_WORDS.test(t.title), t.id).toBe(false);
  });

  it("only uses known placeholders", () => {
    for (const t of ALL) {
      const leftovers = t.title.replace(/\{(m|sessions|goal)\}/g, "");
      expect(leftovers, t.id).not.toMatch(/[{}]/);
    }
  });

  it("fits a full-length goal into the title limit", () => {
    const goal = "g".repeat(GOAL_MAX_LENGTH);
    for (const t of ALL) {
      const title = fillTitle(t.title, { minutes: 60, sessions: 5, goal });
      expect(title.length, t.id).toBeLessThanOrEqual(QUEST_TITLE_MAX_LENGTH);
    }
  });
});

describe("fillTitle", () => {
  it("fills minutes, sessions and goal", () => {
    expect(fillTitle("Read for {m} minutes", { minutes: 15 })).toBe("Read for 15 minutes");
    expect(
      fillTitle('Study on {sessions} days toward "{goal}"', { sessions: 3, goal: "Pass the exam" }),
    ).toBe('Study on 3 days toward "Pass the exam"');
  });
});
