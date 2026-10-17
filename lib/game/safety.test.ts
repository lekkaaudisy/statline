import { describe, expect, it } from "vitest";
import { CLASS_INFO, CLASSES } from "./classes";
import { isSafeGoalText } from "./safety";

describe("isSafeGoalText", () => {
  it.each([
    "Eat under 1500 calories a day",
    "Lose 10 kg by summer",
    "Lose weight",
    "Weight loss before the wedding",
    "Drop two dress sizes",
    "Try intermittent fasting",
    "Fast for 16 hours a day",
    "Skip breakfast every day",
    "Weigh under 60 kg",
    "Get my BMI down",
    "Lose belly fat",
    "Burn more fat",
    "Get skinnier",
    "Shrink my waist",
    "Go on a diet",
  ])("blocks %j", (goal) => {
    expect(isSafeGoalText(goal)).toBe(false);
  });

  it.each([
    "Run 5 km fast",
    "Deadlift 100 kg with good form",
    "Learn to cook three new meals",
    "Read every night before bed",
    "Think more clearly in meetings",
    "Gain confidence when speaking",
  ])("allows %j", (goal) => {
    expect(isSafeGoalText(goal)).toBe(true);
  });

  it("allows every example goal offered in onboarding", () => {
    for (const id of CLASSES) {
      for (const goal of CLASS_INFO[id].exampleGoals) {
        expect(isSafeGoalText(goal), goal).toBe(true);
      }
    }
  });
});
