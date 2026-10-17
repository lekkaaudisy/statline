import { describe, expect, it } from "vitest";
import { addDays, daysBetween, toIsoDate, weekStart } from "./dates";

describe("daysBetween", () => {
  it("counts whole days from one date to a later one", () => {
    expect(daysBetween("2026-10-01", "2026-10-01")).toBe(0);
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
  });

  it("is negative when the second date is earlier", () => {
    expect(daysBetween("2026-10-08", "2026-10-01")).toBe(-7);
  });

  it("works across month and year boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // leap year
  });
});

describe("addDays", () => {
  it("moves forwards and backwards", () => {
    expect(addDays("2026-10-17", 3)).toBe("2026-10-20");
    expect(addDays("2026-10-17", -17)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("weekStart", () => {
  it("gives the Monday of the week", () => {
    expect(weekStart("2026-10-12")).toBe("2026-10-12"); // Monday
    expect(weekStart("2026-10-15")).toBe("2026-10-12"); // Thursday
    expect(weekStart("2026-10-17")).toBe("2026-10-12"); // Saturday
  });

  it("puts Sunday in the week that started the Monday before", () => {
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
  });

  it("works across a year boundary", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });
});

describe("toIsoDate", () => {
  it("gives the UTC calendar date", () => {
    expect(toIsoDate(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-17");
    expect(toIsoDate(new Date("2026-10-18T00:10:00Z"))).toBe("2026-10-18");
  });
});
