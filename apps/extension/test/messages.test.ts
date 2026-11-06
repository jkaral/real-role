import type { ParsedPosting } from "@real-role/shared";
import { describe, expect, it } from "vitest";
import { validateMessage, type SenderInfo } from "../src/lib/messages";

const ID = "abcdefghijklmnopabcdefghijklmnop";
const PAGE = "https://jobs.lever.co/bramblecrest/42";
// Fictional employer only (A2).
const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  descriptionText: "Own deployment pipelines.",
  sourceUrl: PAGE,
  source: "lever",
  parsedBy: "lever",
};
const contentScript: SenderInfo = { id: ID, url: PAGE, frameId: 0, tab: { id: 7, url: PAGE } };
const sidePanel: SenderInfo = { id: ID, url: `chrome-extension://${ID}/sidepanel.html` };

describe("validateMessage", () => {
  it("accepts a content script reporting the posting on its own page", () => {
    expect(validateMessage({ type: "posting-found", posting }, contentScript, ID)).toEqual({
      type: "posting-found",
      tabId: 7,
      posting,
    });
    expect(validateMessage({ type: "open-panel" }, contentScript, ID)).toEqual({
      type: "open-panel",
      tabId: 7,
    });
  });

  it("rejects other extensions and unknown senders", () => {
    expect(
      validateMessage({ type: "open-panel" }, { ...contentScript, id: "other" }, ID),
    ).toBeNull();
    expect(
      validateMessage({ type: "open-panel" }, { ...contentScript, id: undefined }, ID),
    ).toBeNull();
  });

  it("rejects malformed or unknown messages", () => {
    expect(
      validateMessage({ type: "posting-found", posting: { title: "" } }, contentScript, ID),
    ).toBeNull();
    expect(validateMessage({ type: "delete-everything" }, contentScript, ID)).toBeNull();
    expect(validateMessage("open-panel", contentScript, ID)).toBeNull();
  });

  it("rejects postings claiming a different page than the sender's", () => {
    const spoofed = { ...posting, sourceUrl: "https://jobs.lever.co/other/1" };
    expect(
      validateMessage({ type: "posting-found", posting: spoofed }, contentScript, ID),
    ).toBeNull();
  });

  it("uses the browser's current top-frame URL for same-origin SPA navigation", () => {
    const current = "https://jobs.lever.co/bramblecrest/43";
    const sender = { ...contentScript, tab: { id: 7, url: current } };
    expect(
      validateMessage(
        { type: "posting-found", posting: { ...posting, sourceUrl: current } },
        sender,
        ID,
      ),
    ).toMatchObject({ type: "posting-found", tabId: 7 });
    expect(validateMessage({ type: "posting-found", posting }, sender, ID)).toBeNull();
    expect(validateMessage({ type: "no-posting" }, sender, ID)).toEqual({
      type: "no-posting",
      tabId: 7,
      url: current,
    });
  });

  it("rejects an old document claiming a tab that navigated to a different origin", () => {
    const current = "https://careers.example/role";
    const sender = { ...contentScript, tab: { id: 7, url: current } };
    expect(
      validateMessage(
        { type: "posting-found", posting: { ...posting, sourceUrl: current } },
        sender,
        ID,
      ),
    ).toBeNull();
    expect(validateMessage({ type: "no-posting" }, sender, ID)).toBeNull();
  });

  it("ignores subframes", () => {
    expect(
      validateMessage({ type: "open-panel" }, { ...contentScript, frameId: 3 }, ID),
    ).toBeNull();
  });

  it("only lets extension pages ask to check a tab", () => {
    expect(validateMessage({ type: "check-tab", tabId: 9 }, sidePanel, ID)).toEqual({
      type: "check-tab",
      tabId: 9,
    });
    expect(validateMessage({ type: "check-tab", tabId: 9 }, contentScript, ID)).toBeNull();
    expect(validateMessage({ type: "posting-found", posting }, sidePanel, ID)).toBeNull();
  });
});
