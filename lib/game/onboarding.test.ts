import { describe, expect, it } from "vitest";
import {
  answersToProvisionalGrades,
  goalError,
  QUESTIONS,
  scoreStat,
  scoreToGrade,
  validateOnboarding,
  type Answers,
} from "./onboarding";
import { EARNED_STATS, GRADES } from "./stats";

// Every question answered with the same option.
function allAnswers(option: number): Answers {
  return Object.fromEntries(QUESTIONS.map((q) => [q.id, option]));
}

const validInput = {
  mainClass: "scholar",
  secondClass: "monk",
  goal: "Complete an online course",
  dailyMinutes: 30,
  answers: allAnswers(1),
};

describe("QUESTIONS", () => {
  it("has 8 to 10 questions with unique ids", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(8);
    expect(QUESTIONS.length).toBeLessThanOrEqual(10);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });

  it("asks exactly two questions per earned stat and none for Potential", () => {
    for (const stat of EARNED_STATS) {
      expect(QUESTIONS.filter((q) => q.stat === stat)).toHaveLength(2);
    }
    expect(QUESTIONS.some((q) => (q.stat as string) === "potential")).toBe(
      false,
    );
  });
});

describe("scoreStat", () => {
  it("adds the two answers for that stat only", () => {
    const answers = { ...allAnswers(0), S1: 3, S2: 2, P1: 1 };
    expect(scoreStat("strength", answers)).toBe(5);
    expect(scoreStat("speed", answers)).toBe(1);
    expect(scoreStat("endurance", answers)).toBe(0);
  });
});

describe("scoreToGrade", () => {
  it.each([
    [0, "F"],
    [1, "E"],
    [2, "D"],
    [3, "C"],
    [4, "C"],
    [5, "B"],
    [6, "A"],
  ] as const)("score %i gives %s before the cap", (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});

describe("answersToProvisionalGrades", () => {
  it("caps a perfect self-report at B", () => {
    const grades = answersToProvisionalGrades(allAnswers(3));
    for (const stat of EARNED_STATS) expect(grades[stat]).toBe("B");
  });

  it("gives F for all-lowest answers", () => {
    const grades = answersToProvisionalGrades(allAnswers(0));
    for (const stat of EARNED_STATS) expect(grades[stat]).toBe("F");
  });

  it("gives C for typical middle answers", () => {
    const grades = answersToProvisionalGrades(allAnswers(2));
    for (const stat of EARNED_STATS) expect(grades[stat]).toBe("C");
  });

  it("always starts Potential at C, whatever the answers", () => {
    for (const option of [0, 1, 2, 3]) {
      expect(answersToProvisionalGrades(allAnswers(option)).potential).toBe(
        "C",
      );
    }
  });

  it("scores each stat separately", () => {
    const grades = answersToProvisionalGrades({
      S1: 3,
      S2: 3,
      P1: 0,
      P2: 0,
      E1: 1,
      E2: 1,
      I1: 2,
      I2: 0,
    });
    expect(grades).toEqual({
      strength: "B",
      speed: "F",
      endurance: "D",
      intelligence: "D",
      potential: "C",
    });
  });

  it("never goes above B for any possible set of answers", () => {
    const highestAllowed = GRADES.indexOf("B");
    // Every combination of the two answers for one stat covers every score.
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        const answers = { ...allAnswers(0), S1: a, S2: b };
        const grade = answersToProvisionalGrades(answers).strength;
        expect(GRADES.indexOf(grade)).toBeLessThanOrEqual(highestAllowed);
      }
    }
  });
});

describe("goalError", () => {
  it("accepts a normal goal", () => {
    expect(goalError("Run 5 km without stopping")).toBeNull();
  });

  it("rejects an empty or too long goal", () => {
    expect(goalError("   ")).not.toBeNull();
    expect(goalError("x".repeat(121))).not.toBeNull();
    expect(goalError("x".repeat(120))).toBeNull();
  });

  it("rejects a weight-loss goal", () => {
    expect(goalError("Lose 5 kg")).toMatch(/activity and skill/);
  });
});

describe("validateOnboarding", () => {
  it("accepts a complete, valid input and trims the goal", () => {
    const result = validateOnboarding({ ...validInput, goal: "  Read more  " });
    expect(result).toEqual({
      ok: true,
      value: { ...validInput, goal: "Read more" },
    });
  });

  it("allows no second Class", () => {
    expect(validateOnboarding({ ...validInput, secondClass: null }).ok).toBe(
      true,
    );
  });

  it.each([
    ["no input", null],
    ["an unknown main Class", { ...validInput, mainClass: "wizard" }],
    ["a missing second Class field", { ...validInput, secondClass: undefined }],
    ["the same second Class", { ...validInput, secondClass: "scholar" }],
    ["an unsafe goal", { ...validInput, goal: "Count calories" }],
    ["a goal that is not text", { ...validInput, goal: 5 }],
    ["daily minutes not 15, 30 or 60", { ...validInput, dailyMinutes: 45 }],
    ["daily minutes as text", { ...validInput, dailyMinutes: "30" }],
    ["a missing answer", { ...validInput, answers: { ...allAnswers(1), I2: undefined } }],
    ["an answer out of range", { ...validInput, answers: { ...allAnswers(1), S1: 4 } }],
    ["a negative answer", { ...validInput, answers: { ...allAnswers(1), S1: -1 } }],
    ["a fractional answer", { ...validInput, answers: { ...allAnswers(1), S1: 1.5 } }],
    ["an extra answer", { ...validInput, answers: { ...allAnswers(1), X9: 1 } }],
  ])("rejects %s", (_label, input) => {
    expect(validateOnboarding(input).ok).toBe(false);
  });
});
