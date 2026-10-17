import { describe, expect, it } from "vitest";
import { REWARD_TIERS, validateTreats } from "./rewards";

describe("reward treats", () => {
  it("covers the five MVP tiers", () => {
    expect(REWARD_TIERS).toEqual(["Bronze", "Silver", "Gold", "Platinum", "Diamond"]);
  });

  it("cleans treats and drops empty ones", () => {
    expect(validateTreats({ Bronze: "  A   new  book ", Silver: "", Gold: null })).toEqual({
      ok: true,
      value: { Bronze: "A new book" },
    });
  });

  it("ignores tiers that cannot drop in the MVP", () => {
    expect(validateTreats({ Master: "A holiday" })).toEqual({ ok: true, value: {} });
  });

  it("checks the length", () => {
    expect(validateTreats({ Bronze: "ab" }).ok).toBe(false);
    expect(validateTreats({ Bronze: "a".repeat(61) }).ok).toBe(false);
    expect(validateTreats({ Bronze: "a".repeat(60) }).ok).toBe(true);
  });

  it("refuses treats about weight or dieting", () => {
    expect(validateTreats({ Gold: "A day off my diet" }).ok).toBe(false);
    expect(validateTreats({ Gold: "Lose 2 kg" }).ok).toBe(false);
  });

  it("refuses bad input", () => {
    expect(validateTreats(null).ok).toBe(false);
    expect(validateTreats({ Bronze: 5 }).ok).toBe(false);
  });
});
