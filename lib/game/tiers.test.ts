import { describe, expect, it } from "vitest";
import { tierForRank } from "./tiers";

describe("tierForRank", () => {
  it("matches each difficulty rank to its card tier", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(tierForRank)).toEqual([
      "Bronze",
      "Silver",
      "Gold",
      "Platinum",
      "Diamond",
      "Master",
      "Challenger",
    ]);
  });

  it("stays on the ladder for odd input", () => {
    expect(tierForRank(0)).toBe("Bronze");
    expect(tierForRank(9)).toBe("Challenger");
  });
});
