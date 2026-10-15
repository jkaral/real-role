import { describe, expect, it } from "vitest";
import { adapters, detectBoard } from "../src";

describe("ats stub", () => {
  it("exports the three launch adapters", () => {
    expect(adapters.map((a) => a.id)).toEqual(["greenhouse", "lever", "ashby"]);
  });

  it("detectBoard returns null when nothing matches", async () => {
    await expect(detectBoard("bramblecrest.example")).resolves.toBeNull();
  });
});
