import { describe, expect, it } from "vitest";
import * as constants from "@/lib/game/constants";

// Sample test: proves Vitest runs and the @/ import shortcut works.
// Replace with real game tests from Slice 2 onwards.
describe("setup", () => {
  it("loads the game constants module", () => {
    expect(constants).toBeDefined();
  });
});
