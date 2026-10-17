import { describe, expect, it } from "vitest";
import { GRADE_THRESHOLDS, RARE_RANGE_START_POINTS } from "./constants";
import {
  capGrade,
  gradeToPoints,
  maxGrade,
  pointsToGrade,
  progressToNext,
  stepDown,
  stepToward,
} from "./grades";
import { GRADES } from "./stats";

describe("gradeToPoints", () => {
  it("uses the thresholds from CLAUDE.md", () => {
    expect(GRADES.map(gradeToPoints)).toEqual([
      0, 20, 45, 75, 110, 150, 200, 260, 330,
    ]);
    expect(RARE_RANGE_START_POINTS).toBe(420);
  });

  it("needs more points for each step than the last", () => {
    const points = [...GRADES.map(gradeToPoints), RARE_RANGE_START_POINTS];
    for (let i = 2; i < points.length; i++) {
      expect(points[i] - points[i - 1]).toBeGreaterThan(
        points[i - 1] - points[i - 2],
      );
    }
  });
});

describe("pointsToGrade", () => {
  it("gives each grade exactly at its threshold", () => {
    for (const grade of GRADES) {
      expect(pointsToGrade(GRADE_THRESHOLDS[grade])).toBe(grade);
    }
  });

  it("stays on the lower grade one point below every threshold", () => {
    for (let i = 1; i < GRADES.length; i++) {
      expect(pointsToGrade(GRADE_THRESHOLDS[GRADES[i]] - 1)).toBe(
        GRADES[i - 1],
      );
    }
  });

  it("gives F for zero and SSS for very high points", () => {
    expect(pointsToGrade(0)).toBe("F");
    expect(pointsToGrade(10_000)).toBe("SSS");
  });

  it("handles negative and fractional points safely", () => {
    expect(pointsToGrade(-5)).toBe("F");
    expect(pointsToGrade(74.9)).toBe("D");
    expect(pointsToGrade(Number.NaN)).toBe("F");
  });
});

describe("progressToNext", () => {
  it("starts at 0% exactly on a threshold", () => {
    expect(progressToNext(75)).toEqual({
      grade: "C",
      next: "B",
      pointsToNext: 35,
      percent: 0,
    });
  });

  it("shows the share of the step done so far", () => {
    expect(progressToNext(92)).toEqual({
      grade: "C",
      next: "B",
      pointsToNext: 18,
      percent: 49,
    });
  });

  it("is almost full one point below the next grade", () => {
    expect(progressToNext(109)).toEqual({
      grade: "C",
      next: "B",
      pointsToNext: 1,
      percent: 97,
    });
  });

  it("works from zero", () => {
    expect(progressToNext(0)).toEqual({
      grade: "F",
      next: "E",
      pointsToNext: 20,
      percent: 0,
    });
  });

  it("points at SR from SSS", () => {
    expect(progressToNext(330)).toEqual({
      grade: "SSS",
      next: "SR",
      pointsToNext: 90,
      percent: 0,
    });
  });

  it("is full with nothing next at or past the Rare range", () => {
    for (const points of [420, 5000]) {
      expect(progressToNext(points)).toEqual({
        grade: "SSS",
        next: null,
        pointsToNext: 0,
        percent: 100,
      });
    }
  });

  it("never shows 100% before the next grade is reached", () => {
    for (let points = 0; points < RARE_RANGE_START_POINTS; points++) {
      const { percent } = progressToNext(points);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThan(100);
    }
  });

  it("treats negative points as zero", () => {
    expect(progressToNext(-10).percent).toBe(0);
    expect(progressToNext(-10).pointsToNext).toBe(20);
  });
});

describe("stepDown", () => {
  it("moves down the ladder", () => {
    expect(stepDown("A", 2)).toBe("C");
    expect(stepDown("SSS", 2)).toBe("S");
    expect(stepDown("C", 0)).toBe("C");
  });

  it("never goes below F", () => {
    expect(stepDown("D", 2)).toBe("F");
    expect(stepDown("E", 2)).toBe("F");
    expect(stepDown("F", 2)).toBe("F");
  });
});

describe("stepToward", () => {
  it("moves at most the given number of steps toward the target", () => {
    expect(stepToward("C", "S", 1)).toBe("B");
    expect(stepToward("C", "F", 1)).toBe("D");
    expect(stepToward("C", "S", 2)).toBe("A");
  });

  it("stops at the target", () => {
    expect(stepToward("C", "B", 3)).toBe("B");
    expect(stepToward("C", "C", 1)).toBe("C");
  });
});

describe("maxGrade", () => {
  it("gives the higher grade", () => {
    expect(maxGrade("C", "A")).toBe("A");
    expect(maxGrade("SS", "B")).toBe("SS");
    expect(maxGrade("D", "D")).toBe("D");
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
