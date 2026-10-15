import { describe, expect, it } from "vitest";
import { parsers, parsePosting } from "../src";

describe("parsers stub", () => {
  it("exports the parser list and entry point", () => {
    expect(Array.isArray(parsers)).toBe(true);
    expect(typeof parsePosting).toBe("function");
  });
});
