import { describe, expect, it } from "vitest";
import { pick, seededRandom } from "./random";

describe("seededRandom", () => {
  it("gives the same numbers for the same seed", () => {
    const a = seededRandom("user-1:2026-10-17");
    const b = seededRandom("user-1:2026-10-17");
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("gives different numbers for different seeds", () => {
    const a = seededRandom("user-1:2026-10-17");
    const b = seededRandom("user-1:2026-10-18");
    const first = Array.from({ length: 5 }, a);
    const second = Array.from({ length: 5 }, b);
    expect(first).not.toEqual(second);
  });

  it("stays between 0 and 1", () => {
    const random = seededRandom("range");
    for (let i = 0; i < 1000; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("pick", () => {
  it("picks every item sometimes", () => {
    const random = seededRandom("spread");
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pick(["a", "b", "c"], random));
    expect(seen).toEqual(new Set(["a", "b", "c"]));
  });

  it("refuses an empty list", () => {
    expect(() => pick([], seededRandom("x"))).toThrow();
  });
});
