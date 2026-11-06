import { describe, expect, it } from "vitest";
import { followUpCalendar, followUpDraft } from "../src/lib/follow-up";
import type { TrackedApplication } from "@real-role/shared";
const app: TrackedApplication = {
  id: "a1",
  postingId: "p1",
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  sourceUrl: "https://bramblecrest.example/jobs/42",
  status: "applied",
  savedAt: "2026-10-10T12:00:00Z",
  appliedAt: "2026-10-11T12:00:00Z",
  followUpAt: "2026-11-01T09:00:00-05:00",
  statusChangedAt: "2026-10-11T12:00:00Z",
  notes: null,
  scoreAtSave: 80,
  confidenceAtSave: "medium",
};
describe("calendar and templates", () => {
  it("uses the exact stored instant across DST with stable IDs and CRLF lines", () => {
    const value = followUpCalendar(app, new Date("2026-10-15T12:00:00Z"));
    expect(value).toContain("DTSTART:20261101T140000Z\r\nDTEND:20261101T143000Z");
    expect(value).toContain("UID:a1@real-role");
    expect(value.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("escapes property injection and folds UTF-8 lines without splitting characters", () => {
    const value = followUpCalendar({
      ...app,
      title: "工程師".repeat(80) + "\r\nBEGIN:VEVENT;evil,test",
    });
    expect(value.match(/\r\nBEGIN:VEVENT/g)?.length).toBe(1);
    for (const line of value.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(value).toContain("\\nBEGIN:VEVENT\\;evil\\,test");
  });
  it("requires a follow-up date and leaves sending to the user", () => {
    expect(() => followUpCalendar({ ...app, followUpAt: null })).toThrow();
    expect(followUpDraft(app, "application")).toContain("[name]");
    expect(followUpDraft(app, "interview")).toContain("[specific topic]");
  });
});
