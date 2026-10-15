import { describe, expect, it } from "vitest";
import {
  fingerprint,
  fnv1a64,
  normalizeCompany,
  normalizeDescription,
  normalizeTitle,
  roleKey,
} from "../src";

const base = {
  title: "Senior Platform Engineer (Remote)",
  company: "Northwind Lumen, Inc.",
  location: "Toronto, ON",
  descriptionText:
    "Join the Lumen platform team. You will own our deploy pipeline. Req #4821, posted 2026-09-01.",
};

describe("normalization", () => {
  it("strips bracketed noise and punctuation from titles", () => {
    expect(normalizeTitle("Senior Platform Engineer (Remote)")).toBe("senior platform engineer");
    expect(normalizeTitle("Sr. Engineer — [Hiring Now]")).toBe("sr engineer");
  });

  it("strips legal suffixes from company names", () => {
    expect(normalizeCompany("Northwind Lumen, Inc.")).toBe("northwind lumen");
    expect(normalizeCompany("Northwind Lumen LLC")).toBe("northwind lumen");
  });

  it("removes accents", () => {
    expect(normalizeCompany("Café Réseau GmbH")).toBe("cafe reseau");
  });

  it("drops numbers from descriptions", () => {
    expect(normalizeDescription("Req #4821, posted 2026-09-01.")).toBe("req posted");
  });
});

describe("fnv1a64", () => {
  it("matches the reference FNV-1a 64 vectors", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
  });
});

describe("fingerprint", () => {
  it("is stable and versioned", () => {
    const fp = fingerprint(base);
    expect(fp).toMatch(/^fp1_[0-9a-f]{16}$/);
    expect(fingerprint({ ...base })).toBe(fp);
  });

  it("ignores casing, suffixes and refreshed numbers", () => {
    const repost = {
      ...base,
      title: "senior platform engineer",
      company: "Northwind Lumen",
      descriptionText:
        "Join the Lumen platform team.  You will own our deploy pipeline. Req #5999, posted 2026-10-10.",
    };
    expect(fingerprint(repost)).toBe(fingerprint(base));
  });

  it("changes when the description content changes", () => {
    expect(fingerprint({ ...base, descriptionText: "Something else entirely." })).not.toBe(
      fingerprint(base),
    );
  });
});

describe("roleKey", () => {
  it("survives description edits but not location changes", () => {
    const k = roleKey(base);
    expect(k).toMatch(/^fp1r_[0-9a-f]{16}$/);
    expect(roleKey({ ...base, title: "Senior Platform Engineer" })).toBe(k);
    expect(roleKey({ ...base, location: "Austin, TX" })).not.toBe(k);
  });
});
