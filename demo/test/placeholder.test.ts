import { describe, expect, it } from "vitest";
import { DEMO_OUTPUT } from "../src";

describe("demo stub", () => {
  it("knows where the video goes", () => {
    expect(DEMO_OUTPUT).toBe("demo/output/real-role-demo.mp4");
  });
});
