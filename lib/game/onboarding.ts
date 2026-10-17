// Onboarding: the behaviour questions, turning answers into provisional
// grades, and checking everything the user picked before it is saved.
import { isClassId, type ClassId } from "./classes";
import {
  DAILY_MINUTES_OPTIONS,
  GOAL_MAX_LENGTH,
  ONBOARDING_SCORE_BANDS,
  POTENTIAL_START_GRADE,
  SELF_REPORT_GRADE_CAP,
} from "./constants";
import { capGrade } from "./grades";
import { isSafeGoalText } from "./safety";
import { EARNED_STATS, type EarnedStat, type Grade, type Stat } from "./stats";

export type Question = {
  id: string;
  stat: EarnedStat;
  text: string;
  // Lowest first: an answer scores its position in this list (0 to 3).
  options: readonly [string, string, string, string];
};

// Two questions per earned stat, about recent facts, not self-image.
export const QUESTIONS: readonly Question[] = [
  {
    id: "S1",
    stat: "strength",
    text: "In the last 7 days, on how many days did you get at least 20 minutes of activity that made you breathe harder (brisk walk, sport, training, physical work)?",
    options: ["0 days", "1 to 2 days", "3 to 4 days", "5 days or more"],
  },
  {
    id: "S2",
    stat: "strength",
    text: "In the last 7 days, how many strength or skill training sessions did you do (push-ups, weights, climbing, martial arts, yoga, dance)?",
    options: ["None", "1", "2 to 3", "4 or more"],
  },
  {
    id: "P1",
    stat: "speed",
    text: "On your last workday or school day, how many of the tasks you planned did you finish?",
    options: [
      "I did not plan any",
      "Less than half",
      "About half or more",
      "All of them",
    ],
  },
  {
    id: "P2",
    stat: "speed",
    text: "In the last 7 days, how many times did you miss a deadline or put off something you had promised to do?",
    options: ["4 times or more", "2 to 3 times", "Once", "Never"],
  },
  {
    id: "E1",
    stat: "endurance",
    text: "In the last 7 nights, how many nights did you sleep 7 hours or more?",
    options: ["0 to 1", "2 to 3", "4 to 5", "6 to 7"],
  },
  {
    id: "E2",
    stat: "endurance",
    text: "In the last 14 days, on how many days did you keep up a habit you care about?",
    options: ["0 to 3 days", "4 to 7 days", "8 to 11 days", "12 to 14 days"],
  },
  {
    id: "I1",
    stat: "intelligence",
    text: "In the last 7 days, on how many days did you spend 15 minutes or more learning on purpose (a book, a course, or practising a skill)?",
    options: ["0 days", "1 to 2 days", "3 to 4 days", "5 days or more"],
  },
  {
    id: "I2",
    stat: "intelligence",
    text: "In the last 30 days, did you finish something that taught you something new (a book, a course module, a tutorial project, a new skill)?",
    options: [
      "No",
      "I started one",
      "I finished one",
      "I finished two or more",
    ],
  },
];

// Question id -> chosen option (0 to 3).
export type Answers = Record<string, number>;

// Adds up the answers to one stat's questions (0 to 6).
export function scoreStat(stat: EarnedStat, answers: Answers): number {
  return QUESTIONS.filter((q) => q.stat === stat).reduce(
    (sum, q) => sum + (answers[q.id] ?? 0),
    0,
  );
}

// The grade a score earns before the self-report cap.
export function scoreToGrade(score: number): Grade {
  const band = ONBOARDING_SCORE_BANDS.find((b) => score >= b.minScore);
  return band ? band.grade : "F";
}

// The provisional grade for every stat. Earned stats come from the answers,
// capped at B. Potential always starts at C.
export function answersToProvisionalGrades(
  answers: Answers,
): Record<Stat, Grade> {
  const grades = { potential: POTENTIAL_START_GRADE } as Record<Stat, Grade>;
  for (const stat of EARNED_STATS) {
    grades[stat] = capGrade(
      scoreToGrade(scoreStat(stat, answers)),
      SELF_REPORT_GRADE_CAP,
    );
  }
  return grades;
}

export type OnboardingInput = {
  mainClass: ClassId;
  secondClass: ClassId | null;
  goal: string;
  dailyMinutes: (typeof DAILY_MINUTES_OPTIONS)[number];
  answers: Answers;
};

export type ValidationResult =
  | { ok: true; value: OnboardingInput }
  | { ok: false; error: string };

// Checks the goal on its own, so the goal screen can show the message early.
export function goalError(goal: string): string | null {
  const trimmed = goal.trim();
  if (!trimmed) return "Choose a goal or write your own.";
  if (trimmed.length > GOAL_MAX_LENGTH) {
    return `Keep your goal to ${GOAL_MAX_LENGTH} characters or fewer.`;
  }
  if (!isSafeGoalText(trimmed)) {
    return "Statline goals are about activity and skill, not weight, food or body size. Try a goal about something you want to do or learn.";
  }
  return null;
}

// Checks everything from the onboarding screens. The data comes from the
// browser, so nothing is trusted until it passes here.
export function validateOnboarding(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Something went wrong. Please start again." };
  }
  const { mainClass, secondClass, goal, dailyMinutes, answers } =
    input as Record<string, unknown>;

  if (!isClassId(mainClass)) {
    return { ok: false, error: "Choose your main Class." };
  }
  if (secondClass !== null && !isClassId(secondClass)) {
    return { ok: false, error: "Choose a second Class, or none." };
  }
  if (secondClass === mainClass) {
    return {
      ok: false,
      error: "Your second Class must be different from your main Class.",
    };
  }

  if (typeof goal !== "string") {
    return { ok: false, error: "Choose a goal or write your own." };
  }
  const goalProblem = goalError(goal);
  if (goalProblem) return { ok: false, error: goalProblem };

  if (
    !DAILY_MINUTES_OPTIONS.includes(
      dailyMinutes as OnboardingInput["dailyMinutes"],
    )
  ) {
    return { ok: false, error: "Choose how much time you have each day." };
  }

  if (typeof answers !== "object" || answers === null) {
    return { ok: false, error: "Answer every question." };
  }
  const given = answers as Record<string, unknown>;
  const cleanAnswers: Answers = {};
  for (const q of QUESTIONS) {
    const value = given[q.id];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value >= q.options.length
    ) {
      return { ok: false, error: "Answer every question." };
    }
    cleanAnswers[q.id] = value;
  }
  if (Object.keys(given).length !== QUESTIONS.length) {
    return { ok: false, error: "Something went wrong. Please start again." };
  }

  return {
    ok: true,
    value: {
      mainClass,
      secondClass,
      goal: goal.trim(),
      dailyMinutes: dailyMinutes as OnboardingInput["dailyMinutes"],
      answers: cleanAnswers,
    },
  };
}
