import { GRADE_THRESHOLDS } from "./constants";
import { GRADES, type Grade } from "./stats";

// Points at the bottom of a grade, e.g. C -> 75.
export function gradeToPoints(grade: Grade): number {
  return GRADE_THRESHOLDS[grade];
}

// The highest grade the points reach. Slice 3 adds progress and decay.
export function pointsToGrade(points: number): Grade {
  let result: Grade = "F";
  for (const grade of GRADES) {
    if (points >= GRADE_THRESHOLDS[grade]) result = grade;
  }
  return result;
}

// The lower of the grade and the cap.
export function capGrade(grade: Grade, cap: Grade): Grade {
  return GRADES.indexOf(grade) > GRADES.indexOf(cap) ? cap : grade;
}
