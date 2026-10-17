import { describe, expect, it } from "vitest";
import {
  allowedProofs,
  honourAllowed,
  isOwnPhotoPath,
  proofError,
  proofPhotoPath,
  proofPoints,
} from "./proof";

const USER = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-2222-3333-4444-555555555555";
const rank2 = { rank: 2, allowedProofs: ["evidence", "honour"] };
const rank5 = { rank: 5, allowedProofs: ["evidence"] };

describe("proofPoints", () => {
  it("gives 100% for auto and crew, 80% for evidence, 50% for honour", () => {
    expect(proofPoints(10, "auto")).toBe(10);
    expect(proofPoints(10, "crew")).toBe(10);
    expect(proofPoints(10, "evidence")).toBe(8);
    expect(proofPoints(10, "honour")).toBe(5);
  });

  it("rounds to whole points, halves up", () => {
    expect(proofPoints(6, "evidence")).toBe(5); // 4.8
    expect(proofPoints(9, "honour")).toBe(5); // 4.5
    expect(proofPoints(27, "honour")).toBe(14); // 13.5
    expect(proofPoints(9, "evidence")).toBe(7); // 7.2
  });

  it("never gives honour more than evidence", () => {
    for (const gain of [4, 6, 9, 12, 15, 27, 45]) {
      expect(proofPoints(gain, "honour")).toBeLessThanOrEqual(proofPoints(gain, "evidence"));
    }
  });
});

describe("honour limit", () => {
  it("allows honour up to rank 4 and refuses it from rank 5", () => {
    expect(honourAllowed(4)).toBe(true);
    expect(honourAllowed(5)).toBe(false);
    expect(honourAllowed(6)).toBe(false);
    expect(allowedProofs(4)).toEqual(["evidence", "honour"]);
    expect(allowedProofs(5)).toEqual(["evidence"]);
  });

  it("refuses honour proof on a rank 5 quest even if the quest lists it", () => {
    const tampered = { rank: 5, allowedProofs: ["evidence", "honour"] };
    expect(proofError({ proof: "honour", summary: null, photoPath: null }, tampered, USER)).toMatch(/not allowed/);
  });
});

describe("proofError", () => {
  it("accepts honour with nothing attached on a low rank quest", () => {
    expect(proofError({ proof: "honour", summary: null, photoPath: null }, rank2, USER)).toBeNull();
  });

  it("accepts evidence with a summary or with an own photo", () => {
    expect(proofError({ proof: "evidence", summary: "Ran two laps of the park today.", photoPath: null }, rank5, USER)).toBeNull();
    expect(proofError({ proof: "evidence", summary: null, photoPath: `${USER}/q1-1.jpg` }, rank5, USER)).toBeNull();
  });

  it("refuses evidence with nothing attached", () => {
    expect(proofError({ proof: "evidence", summary: null, photoPath: null }, rank2, USER)).toMatch(/photo or write/);
  });

  it("refuses a summary that is too short or too long", () => {
    expect(proofError({ proof: "evidence", summary: "done", photoPath: null }, rank2, USER)).toMatch(/at least 20/);
    expect(proofError({ proof: "evidence", summary: "x".repeat(501), photoPath: null }, rank2, USER)).toMatch(/500/);
  });

  it("refuses someone else's photo", () => {
    expect(proofError({ proof: "evidence", summary: null, photoPath: `${OTHER}/q1-1.jpg` }, rank2, USER)).toMatch(/could not be found/);
  });

  it("refuses proof the quest does not list", () => {
    expect(proofError({ proof: "honour", summary: null, photoPath: null }, { rank: 2, allowedProofs: ["evidence"] }, USER)).toMatch(/does not accept/);
  });
});

describe("photo paths", () => {
  it("builds a path inside the user's folder", () => {
    const path = proofPhotoPath(USER, "quest-1", 123);
    expect(path).toBe(`${USER}/quest-1-123.jpg`);
    expect(isOwnPhotoPath(path, USER)).toBe(true);
  });

  it("refuses other folders, sub-folders and tricks", () => {
    expect(isOwnPhotoPath(`${OTHER}/a.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/`, USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/x/a.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/../${OTHER}/a.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`a.jpg`, USER)).toBe(false);
  });
});
