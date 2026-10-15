import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src";

describe("scoring stub", () => {
  it("has a version", () => {
    expect(ENGINE_VERSION).toMatch(/^scoring-/);
  });
});
