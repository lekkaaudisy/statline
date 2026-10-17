import { GRADE_THRESHOLDS, RARE_RANGE_START_POINTS } from "./constants";
import { GRADES, type Grade } from "./stats";

// Points at the bottom of a grade, e.g. C -> 75.
export function gradeToPoints(grade: Grade): number {
  return GRADE_THRESHOLDS[grade];
}

// The highest grade the points reach.
export function pointsToGrade(points: number): Grade {
  let result: Grade = "F";
  for (const grade of GRADES) {
    if (points >= GRADE_THRESHOLDS[grade]) result = grade;
  }
  return result;
}

export type Progress = {
  grade: Grade;
  // The next grade up. SR (the Rare range) is shown as a target from SSS but
  // never awarded in the MVP. Null once the points reach SR.
  next: Grade | "SR" | null;
  pointsToNext: number;
  // How far through the current step, 0 to 100 (100 only when there is no
  // next grade).
  percent: number;
};

// Where the points sit between the current grade and the next one.
export function progressToNext(points: number): Progress {
  const safePoints = Math.max(0, points);
  const grade = pointsToGrade(safePoints);
  const index = GRADES.indexOf(grade);
  const next = index < GRADES.length - 1 ? GRADES[index + 1] : "SR";
  const bottom = gradeToPoints(grade);
  const top =
    next === "SR" ? RARE_RANGE_START_POINTS : gradeToPoints(next);

  if (safePoints >= top) {
    return { grade, next: null, pointsToNext: 0, percent: 100 };
  }
  return {
    grade,
    next,
    pointsToNext: Math.ceil(top - safePoints),
    percent: Math.round(((safePoints - bottom) / (top - bottom)) * 100),
  };
}

// The grade `steps` steps lower, never below F.
export function stepDown(grade: Grade, steps: number): Grade {
  return GRADES[Math.max(0, GRADES.indexOf(grade) - steps)];
}

// Moves from `current` toward `target` by at most `maxSteps` steps.
export function stepToward(current: Grade, target: Grade, maxSteps: number): Grade {
  const from = GRADES.indexOf(current);
  const to = GRADES.indexOf(target);
  const move = Math.max(-maxSteps, Math.min(maxSteps, to - from));
  return GRADES[from + move];
}

// The higher of two grades.
export function maxGrade(a: Grade, b: Grade): Grade {
  return GRADES.indexOf(a) >= GRADES.indexOf(b) ? a : b;
}

// The lower of the grade and the cap.
export function capGrade(grade: Grade, cap: Grade): Grade {
  return GRADES.indexOf(grade) > GRADES.indexOf(cap) ? cap : grade;
}
