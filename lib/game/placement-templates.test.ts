import { describe, expect, it } from "vitest";
import { CLASSES } from "./classes";
import { GOAL_MAX_LENGTH, QUEST_TITLE_MAX_LENGTH } from "./constants";
import { QUESTIONS } from "./onboarding";
import { GOAL_PLACEMENTS, QUESTION_PLACEMENTS } from "./placement-templates";
import { fillTitle, type QuestTemplate } from "./quest-templates";
import { isSafeGoalText } from "./safety";
import { EARNED_STATS } from "./stats";

const ALL: QuestTemplate[] = [
  ...Object.values(QUESTION_PLACEMENTS),
  ...CLASSES.flatMap((c) => GOAL_PLACEMENTS[c]),
];

const VIRTUE_WORDS = /\b(kind|kindness|patient|patience|generous|honest|humble|grateful)\b/i;

describe("placement templates", () => {
  it("has one placement quest per onboarding question, on that question's stat", () => {
    for (const q of QUESTIONS) {
      expect(QUESTION_PLACEMENTS[q.id]?.stat, q.id).toBe(q.stat);
    }
    expect(Object.keys(QUESTION_PLACEMENTS)).toHaveLength(QUESTIONS.length);
  });

  it("has three goal placement quests per Class, all about the goal", () => {
    for (const c of CLASSES) {
      expect(GOAL_PLACEMENTS[c]).toHaveLength(3);
      for (const t of GOAL_PLACEMENTS[c]) expect(t.title).toContain("{goal}");
    }
  });

  it("uses unique ids that fit the database (40 characters)", () => {
    expect(new Set(ALL.map((t) => t.id)).size).toBe(ALL.length);
    for (const t of ALL) {
      expect(t.id.startsWith("placement-")).toBe(true);
      expect(t.id.length).toBeLessThanOrEqual(40);
    }
  });

  it("never uses Potential", () => {
    for (const t of ALL) expect(EARNED_STATS).toContain(t.stat);
  });

  it("follows the safety rules and never scores a virtue", () => {
    for (const t of ALL) {
      expect(isSafeGoalText(t.title), t.id).toBe(true);
      expect(t.title, t.id).not.toMatch(VIRTUE_WORDS);
    }
  });

  it("fits the title limit with the longest goal", () => {
    const goal = "x".repeat(GOAL_MAX_LENGTH);
    for (const t of ALL) {
      expect(fillTitle(t.title, { minutes: 60, goal }).length, t.id).toBeLessThanOrEqual(
        QUEST_TITLE_MAX_LENGTH,
      );
    }
  });
});
