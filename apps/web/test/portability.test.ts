import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TrackedApplication } from "@real-role/shared";
import type { Db } from "../src/db/client";
import {
  CSV_COLUMNS,
  exportApplicationsCsv,
  parseApplicationsCsv,
  previewImport,
} from "../src/lib/portability";
import { importApplications } from "../src/server/portability";
import { listApplications } from "../src/server/applications";
import { readShortlist } from "../src/server/shortlist";
import { createUser, resetDb, testDb } from "./db";
const app: TrackedApplication = {
  id: "a1",
  postingId: "p1",
  title: 'Engineer, "Platform"',
  company: "=Bramblecrest Analytics",
  sourceUrl: "https://bramblecrest.example/jobs/42",
  status: "applied",
  savedAt: "2026-10-10T12:00:00Z",
  appliedAt: "2026-10-11T12:00:00Z",
  followUpAt: "2026-10-18T12:00:00Z",
  statusChangedAt: "2026-10-11T12:00:00Z",
  notes: "Line one\nLine two",
  scoreAtSave: 80,
  confidenceAtSave: "medium",
};
describe("CSV parsing and preview", () => {
  it("round-trips commas, quotes, multiline notes and job facts without evaluating formulas", () => {
    const text = exportApplicationsCsv([app], {
      a1: {
        location: "Toronto",
        salary: { min: 100000, max: 130000, currency: "CAD", period: "year" },
        remote: true,
      },
    });
    expect(text).toContain("'=Bramblecrest");
    const [row] = parseApplicationsCsv(text);
    expect(row?.title).toBe(app.title);
    expect(row?.company).toBe(app.company);
    expect(row?.notes).toBe(app.notes);
    expect(row?.facts.salary?.currency).toBe("CAD");
  });
  it("rejects broken quoting, wrong headers, invalid statuses and oversized files", () => {
    expect(() => parseApplicationsCsv('"unclosed')).toThrow();
    expect(() => parseApplicationsCsv("title,company\nEngineer,Bramblecrest")).toThrow();
    expect(() => parseApplicationsCsv("x".repeat(100001))).toThrow();
    expect(() =>
      parseApplicationsCsv(exportApplicationsCsv([{ ...app, status: "unexpected" as "saved" }])),
    ).toThrow(/invalid status/);
    expect(() => parseApplicationsCsv(CSV_COLUMNS.join(",") + "\n")).toThrow(/no application/);
  });
  it("previews existing and within-file duplicates while preserving numeric listing identities", () => {
    const rows = parseApplicationsCsv(
      exportApplicationsCsv([
        app,
        { ...app, id: "a2", sourceUrl: "https://bramblecrest.example/jobs/43" },
        app,
      ]),
    );
    expect(previewImport(rows, [app]).map((p) => p.duplicate)).toEqual([true, false, true]);
  });
});
let db: Db, close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()));
beforeEach(async () => resetDb(db));
afterAll(async () => close());
describe("account-scoped import", () => {
  it("imports only confirmed rows idempotently, distinguishes IDs and keeps other accounts private", async () => {
    const owner = await createUser(db),
      other = await createUser(db, "Other User");
    const rows = parseApplicationsCsv(
      exportApplicationsCsv(
        [app, { ...app, id: "a2", sourceUrl: "https://bramblecrest.example/jobs/43" }],
        { a1: { location: "Toronto" } },
      ),
    );
    expect(await importApplications(db, owner, { rows }, new Date())).toEqual({
      imported: 2,
      duplicates: 0,
    });
    expect(await importApplications(db, owner, { rows }, new Date())).toEqual({
      imported: 0,
      duplicates: 2,
    });
    expect((await listApplications(db, owner)).length).toBe(2);
    expect((await listApplications(db, other)).length).toBe(0);
    const list = await readShortlist(db, owner);
    expect(Object.values(list.facts).some((f) => f.location === "Toronto")).toBe(true);
    expect(list.applications.every((a) => a.scoreAtSave === null)).toBe(true);
  });
});
