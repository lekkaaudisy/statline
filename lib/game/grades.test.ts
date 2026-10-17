import { describe, expect, it } from "vitest";
import { GRADE_THRESHOLDS } from "./constants";
import { capGrade, gradeToPoints, pointsToGrade } from "./grades";
import { GRADES } from "./stats";

describe("gradeToPoints", () => {
  it("uses the thresholds from CLAUDE.md", () => {
    expect(GRADES.map(gradeToPoints)).toEqual([
      0, 20, 45, 75, 110, 150, 200, 260, 330,
    ]);
  });

  it("needs more points for each step than the last", () => {
    for (let i = 2; i < GRADES.length; i++) {
      const step = gradeToPoints(GRADES[i]) - gradeToPoints(GRADES[i - 1]);
      const previousStep =
        gradeToPoints(GRADES[i - 1]) - gradeToPoints(GRADES[i - 2]);
      expect(step).toBeGreaterThan(previousStep);
    }
  });
});

describe("pointsToGrade", () => {
  it("gives each grade exactly at its threshold", () => {
    for (const grade of GRADES) {
      expect(pointsToGrade(GRADE_THRESHOLDS[grade])).toBe(grade);
    }
  });

  it("stays on the lower grade one point below a threshold", () => {
    expect(pointsToGrade(74)).toBe("D");
    expect(pointsToGrade(109)).toBe("C");
  });

  it("gives F for zero and SSS for very high points", () => {
    expect(pointsToGrade(0)).toBe("F");
    expect(pointsToGrade(10_000)).toBe("SSS");
  });
});

describe("capGrade", () => {
  it("lowers grades above the cap", () => {
    expect(capGrade("A", "B")).toBe("B");
    expect(capGrade("SSS", "B")).toBe("B");
  });

  it("keeps grades at or below the cap", () => {
    expect(capGrade("B", "B")).toBe("B");
    expect(capGrade("D", "B")).toBe("D");
  });
});
