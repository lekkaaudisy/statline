import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_POINTS,
  CREW_MAX_MEMBERS,
  WEEKLY_CONFIRMATIONS_COUNTED,
  WEEKLY_GIFTS_COUNTED,
} from "./constants";
import {
  confirmationTopUp,
  confirmWindowOpen,
  contributionScore,
  crewIsFull,
  giftError,
  normalizeInviteCode,
  rankLeaderboard,
  validateCrewName,
} from "./crew";
import { crewTopUp } from "./proof";

const none = { questsCleared: 0, proofsConfirmed: 0, cardsGifted: 0 };

describe("contributionScore", () => {
  it("is 0 for an empty week", () => {
    expect(contributionScore(none)).toBe(0);
  });

  it("adds each action's points", () => {
    expect(contributionScore({ ...none, questsCleared: 5 })).toBe(5 * CONTRIBUTION_POINTS.questCleared);
    expect(contributionScore({ ...none, proofsConfirmed: 2 })).toBe(2 * CONTRIBUTION_POINTS.proofConfirmed);
    expect(contributionScore({ ...none, cardsGifted: 1 })).toBe(CONTRIBUTION_POINTS.cardGifted);
    expect(contributionScore({ questsCleared: 10, proofsConfirmed: 3, cardsGifted: 2 })).toBe(10 + 6 + 4);
  });

  it("counts confirmations only up to the weekly cap", () => {
    const capped = contributionScore({ ...none, proofsConfirmed: WEEKLY_CONFIRMATIONS_COUNTED });
    expect(contributionScore({ ...none, proofsConfirmed: WEEKLY_CONFIRMATIONS_COUNTED + 7 })).toBe(capped);
  });

  it("counts gifts only up to the weekly cap", () => {
    const capped = contributionScore({ ...none, cardsGifted: WEEKLY_GIFTS_COUNTED });
    expect(contributionScore({ ...none, cardsGifted: WEEKLY_GIFTS_COUNTED + 5 })).toBe(capped);
  });

  it("does not cap cleared quests", () => {
    expect(contributionScore({ ...none, questsCleared: 40 })).toBe(40);
  });

  it("ignores negative or broken counts", () => {
    expect(contributionScore({ questsCleared: -3, proofsConfirmed: Number.NaN, cardsGifted: 1.7 })).toBe(
      CONTRIBUTION_POINTS.cardGifted,
    );
  });
});

describe("rankLeaderboard", () => {
  const member = (name: string, questsCleared: number, proofsConfirmed = 0, cardsGifted = 0) => ({
    name,
    counts: { questsCleared, proofsConfirmed, cardsGifted },
  });

  it("puts the highest contribution first", () => {
    const board = rankLeaderboard([member("Ana", 3), member("Ben", 9), member("Cy", 1, 2)]);
    expect(board.map((m) => [m.name, m.score, m.rank])).toEqual([
      ["Ben", 9, 1],
      ["Cy", 5, 2],
      ["Ana", 3, 3],
    ]);
  });

  it("gives equal scores the same rank, listed by name", () => {
    const board = rankLeaderboard([member("Zoe", 4), member("Ana", 4), member("Max", 6), member("Lu", 1)]);
    expect(board.map((m) => [m.name, m.rank])).toEqual([
      ["Max", 1],
      ["Ana", 2],
      ["Zoe", 2],
      ["Lu", 4],
    ]);
  });

  it("keeps the members' other fields", () => {
    const [entry] = rankLeaderboard([{ ...member("Ana", 1), userId: "u1" }]);
    expect(entry.userId).toBe("u1");
  });

  it("handles an empty crew", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });
});

describe("validateCrewName", () => {
  it("trims and squashes spaces", () => {
    expect(validateCrewName("  Night   Owls ")).toEqual({ ok: true, value: "Night Owls" });
  });

  it("refuses names that are too short, too long or missing", () => {
    expect(validateCrewName("ab").ok).toBe(false);
    expect(validateCrewName("x".repeat(31)).ok).toBe(false);
    expect(validateCrewName(undefined).ok).toBe(false);
  });
});

describe("normalizeInviteCode", () => {
  it("accepts any case, spaces and dashes", () => {
    expect(normalizeInviteCode(" abc-23x ")).toBe("ABC23X");
  });

  it("refuses wrong lengths and confusing characters", () => {
    expect(normalizeInviteCode("ABC23")).toBeNull();
    expect(normalizeInviteCode("ABC23XY")).toBeNull();
    expect(normalizeInviteCode("ABCO1I")).toBeNull();
    expect(normalizeInviteCode(42)).toBeNull();
  });
});

describe("crewIsFull", () => {
  it("is full at the member limit", () => {
    expect(crewIsFull(CREW_MAX_MEMBERS - 1)).toBe(false);
    expect(crewIsFull(CREW_MAX_MEMBERS)).toBe(true);
  });
});

describe("giftError", () => {
  const held = { status: "held" as const, giftedBy: null };

  it("allows held System cards", () => {
    for (const kind of ["reroll", "rest", "double_xp", "shield"] as const) {
      expect(giftError({ ...held, kind })).toBeNull();
    }
  });

  it("refuses Reward, Skill and Proof cards", () => {
    for (const kind of ["reward", "skill", "day_one", "exclusive"] as const) {
      expect(giftError({ ...held, kind })).not.toBeNull();
    }
  });

  it("refuses cards not in the hand, and cards already gifted", () => {
    expect(giftError({ kind: "shield", status: "active", giftedBy: null })).not.toBeNull();
    expect(giftError({ kind: "shield", status: "held", giftedBy: "someone" })).not.toBeNull();
  });
});

describe("confirmWindowOpen", () => {
  it("is open on the day of clearing and the next 3 days", () => {
    expect(confirmWindowOpen("2026-10-12", "2026-10-12")).toBe(true);
    expect(confirmWindowOpen("2026-10-12", "2026-10-15")).toBe(true);
    expect(confirmWindowOpen("2026-10-12", "2026-10-16")).toBe(false);
  });
});

describe("crewTopUp", () => {
  it("adds the difference up to 100%", () => {
    expect(crewTopUp(10, "evidence", false)).toBe(2);
    expect(crewTopUp(10, "honour", false)).toBe(5);
    expect(crewTopUp(9, "honour", false)).toBe(4); // 9 - round(4.5)
  });

  it("doubles when Double XP doubled the original award", () => {
    expect(crewTopUp(10, "honour", true)).toBe(10);
  });

  it("adds nothing to proof that is already full", () => {
    expect(crewTopUp(10, "crew", false)).toBe(0);
    expect(crewTopUp(10, "auto", false)).toBe(0);
  });
});

describe("confirmationTopUp", () => {
  it("matches the database's top-up, spotting Double XP from the award", () => {
    expect(confirmationTopUp({ gain: 10, proofType: "evidence", pointsAwarded: 8 })).toBe(2);
    expect(confirmationTopUp({ gain: 10, proofType: "honour", pointsAwarded: 10 })).toBe(10);
    expect(confirmationTopUp({ gain: 10, proofType: "crew", pointsAwarded: 10 })).toBe(0);
  });
});
