import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ParsedPostingSchema } from "@real-role/shared";
import { parseGeneric, parsePosting, parsers } from "../src";

const html = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");
const doc = (input: string, url = "https://bramblecrest.example/jobs/42") =>
  new JSDOM(input, { url }).window.document;
it("extracts graph JSON-LD, salary, dates, employer domain and plain description", () => {
  const result = parseGeneric(doc(html("generic")));
  expect(result).toMatchObject({
    title: "Platform Engineer",
    company: "Bramblecrest Analytics",
    companyDomain: "bramblecrest.example",
    location: "Toronto, ON, CA",
    postedAt: "2026-10-01T00:00:00.000Z",
    validThrough: "2026-11-01T16:00:00.000Z",
    externalId: "role-42",
    salary: { min: 90000, max: 120000, currency: "CAD", period: "year" },
  });
  expect(result?.descriptionText).toContain("Own deployment pipelines.");
  expect(result?.descriptionText).not.toContain("<");
  expect(ParsedPostingSchema.safeParse(result).success).toBe(true);
});
describe.each([
  ["greenhouse", "https://job-boards.greenhouse.io/bramblecrest/jobs/42"],
  ["lever", "https://jobs.lever.co/northwind/42"],
  ["ashby", "https://jobs.ashbyhq.com/mapleglass/42"],
])("%s DOM fallback", (provider, url) => {
  it("reads the supplied document with no global browser or network", () => {
    const result = parsePosting(doc(html(provider!), url));
    expect(result?.source).toBe(provider);
    expect(result?.externalId).toBe("42");
    expect(result?.descriptionText.length).toBeGreaterThan(20);
  });
  it("prefers JSON-LD on hosted pages", () => {
    expect(parsePosting(doc(html("generic"), url))?.source).toBe(provider);
  });
});
it("continues after malformed blocks and rejects ambiguous listing pages", () => {
  const broken = '<script type="application/ld+json">{broken</script>';
  expect(parseGeneric(doc(broken + html("generic")))?.title).toBe("Platform Engineer");
  expect(parseGeneric(doc(html("generic") + html("generic")))).toBeNull();
});
it("does not turn arbitrary articles or partial records into job postings", () => {
  expect(parsePosting(doc("<h1>Careers news</h1><article>We are growing.</article>"))).toBeNull();
  expect(
    parseGeneric(
      doc('<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>'),
    ),
  ).toBeNull();
});
it("supports arrays, remote metadata and missing optional fields", () => {
  const metadata = [
    {
      "@type": ["JobPosting"],
      title: "Engineer",
      hiringOrganization: { name: "Mapleglass Systems" },
      description: "<p>Hello</p><script>bad()</script>",
      jobLocationType: "TELECOMMUTE",
      datePosted: "invalid",
    },
  ];
  const result = parseGeneric(
    doc(
      `<script type="application/ld+json">${JSON.stringify(metadata).replaceAll("</script>", "<\\/script>")}</script>`,
    ),
  );
  expect(result).toMatchObject({ remote: true, descriptionText: "Hello" });
  expect(result?.postedAt).toBeUndefined();
});
it("does not parse timestamps using the machine's local timezone", () => {
  const input = html("generic").replace('"2026-10-01"', '"2026-10-01T12:00:00"');
  expect(parseGeneric(doc(input))?.postedAt).toBeUndefined();
});
it("supports conservative microdata fallback", () => {
  const input =
    '<main itemtype="https://schema.org/JobPosting"><h1 itemprop="title">Analyst</h1><div itemprop="hiringOrganization"><span itemprop="name">Northwind Lumen</span></div><p itemprop="description">Maintain dashboards.</p></main>';
  expect(parseGeneric(doc(input))).toMatchObject({
    title: "Analyst",
    company: "Northwind Lumen",
    parsedBy: "generic-microdata",
  });
});
it("rejects lookalike hosts", () => {
  expect(
    parsers.some((parser) =>
      parser.canParse("https://jobs.lever.co.attacker.example/northwind/42", doc("")),
    ),
  ).toBe(false);
});

it("extracts an explicitly denominated salary from hosted DOM descriptions", () => {
  const input = html("greenhouse").replace(
    "Build deployment pipelines",
    "Salary CAD 90,000–120,000. Build deployment pipelines",
  );
  expect(
    parsePosting(doc(input, "https://boards.greenhouse.io/bramblecrest/jobs/42"))?.salary,
  ).toEqual({ min: 90000, max: 120000, currency: "CAD" });
});
