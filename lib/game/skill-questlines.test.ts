import { describe, expect, it } from "vitest";
import { CLASSES } from "./classes";
import { HONOUR_MAX_RANK, QUEST_TITLE_MAX_LENGTH, STRENGTH_MAX_MINUTES } from "./constants";
import { isSafeGoalText } from "./safety";
import {
  getQuestline,
  questlinesForClasses,
  SKILL_QUESTLINES,
  stepTemplateId,
} from "./skill-questlines";

describe("starter Skill questlines", () => {
  it("has at least 2 per Class", () => {
    for (const id of CLASSES) {
      expect(SKILL_QUESTLINES.filter((q) => q.classId === id).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has 4 to 12 steps each", () => {
    for (const q of SKILL_QUESTLINES) {
      expect(q.steps.length, q.id).toBeGreaterThanOrEqual(4);
      expect(q.steps.length, q.id).toBeLessThanOrEqual(12);
    }
  });

  it("has unique ids that fit the database", () => {
    const ids = SKILL_QUESTLINES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of SKILL_QUESTLINES) {
      expect(stepTemplateId(q.id, q.steps.length).length).toBeLessThanOrEqual(40);
    }
  });

  it("follows the safety rules in every step", () => {
    for (const q of SKILL_QUESTLINES) {
      for (const step of q.steps) {
        expect(isSafeGoalText(step.title), step.title).toBe(true);
        expect(step.title.length).toBeLessThanOrEqual(QUEST_TITLE_MAX_LENGTH);
      }
    }
  });

  it("keeps ranks low enough for honour proof", () => {
    for (const q of SKILL_QUESTLINES) {
      for (const step of q.steps) {
        expect(step.rank).toBeGreaterThanOrEqual(1);
        expect(step.rank).toBeLessThanOrEqual(Math.min(3, HONOUR_MAX_RANK));
      }
    }
  });

  it("caps strength steps at 30 minutes", () => {
    for (const q of SKILL_QUESTLINES) {
      for (const step of q.steps.filter((s) => s.stat === "strength")) {
        const minutes = [...step.title.matchAll(/(\d+)[ -]minutes?/g)].map((m) => Number(m[1]));
        for (const m of minutes) expect(m, step.title).toBeLessThanOrEqual(STRENGTH_MAX_MINUTES);
      }
    }
  });

  it("builds strength up gradually: ranks never drop and rise one at a time", () => {
    for (const q of SKILL_QUESTLINES) {
      const ranks = q.steps.filter((s) => s.stat === "strength").map((s) => s.rank);
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i] - ranks[i - 1], q.id).toBeGreaterThanOrEqual(0);
        expect(ranks[i] - ranks[i - 1], q.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never mentions the Class as a Path", () => {
    for (const q of SKILL_QUESTLINES) {
      expect(JSON.stringify(q)).not.toMatch(/\bpath\b/i);
    }
  });

  it("finds questlines by id and by Class", () => {
    expect(getQuestline("leader-speak")?.name).toBe("Speak with Confidence");
    expect(getQuestline("nope")).toBeUndefined();
    expect(questlinesForClasses("monk", null).map((q) => q.id)).toEqual(["monk-breath", "monk-winddown"]);
    expect(questlinesForClasses("monk", "leader").map((q) => q.classId)).toEqual([
      "monk", "monk", "leader", "leader",
    ]);
  });
});
