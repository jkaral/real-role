import type * as Api from "../src/lib/api";
import type { ParsedPosting, ScoreResponse } from "@real-role/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { browser } from "wxt/browser";

const mocks = vi.hoisted(() => ({ score: vi.fn() }));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof Api>()),
  scorePosting: mocks.score,
}));
import background from "../src/entrypoints/background";

const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  descriptionText: "Own deployment pipelines.",
  sourceUrl: "https://jobs.lever.co/bramblecrest/42",
  source: "lever",
  parsedBy: "lever",
};
const data = (score: number): ScoreResponse => ({
  postingId: `p${score}`,
  fingerprint: "fp1_0000000000000000",
  posting,
  result: {
    score,
    band: score > 70 ? "high" : "low",
    confidence: "medium",
    signals: [],
    computedAt: "2026-10-15T00:00:00.000Z",
    engineVersion: "scoring-1",
    usedLlm: false,
  },
});
let pending: { resolve: (value: ScoreResponse) => void; reject: (error: Error) => void }[];
let listener: Parameters<typeof browser.runtime.onMessage.addListener>[0];

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
  pending = [];
  mocks.score.mockImplementation(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  );
  vi.spyOn(browser.runtime.onMessage, "addListener").mockImplementation((fn) => {
    listener = fn;
  });
  vi.spyOn(browser.storage.session, "setAccessLevel").mockResolvedValue();
  background.main();
});

async function send(type: "posting-found" | "no-posting", url = posting.sourceUrl) {
  const response = vi.fn();
  listener(
    { type, posting: { ...posting, sourceUrl: url } },
    {
      id: browser.runtime.id,
      url,
      frameId: 0,
      tab: { id: 7, url } as NonNullable<Parameters<typeof listener>[1]["tab"]>,
    },
    response,
  );
  // Drain the real async storage/badge calls before settling controlled requests.
  await vi.waitFor(() => expect(browser.storage.session.get("tab:7")).resolves.toBeDefined());
  return response;
}

async function state() {
  return (await browser.storage.session.get("tab:7"))["tab:7"];
}

describe("background request ownership", () => {
  it.each(["success", "failure"])(
    "ignores an older %s after a same-URL retry finishes",
    async (outcome) => {
      const first = await send("posting-found");
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      const second = await send("posting-found");
      await vi.waitFor(() => expect(pending).toHaveLength(2));
      pending[1]!.resolve(data(82));
      await vi.waitFor(() => expect(second).toHaveBeenCalled());
      if (outcome === "success") pending[0]!.resolve(data(19));
      else pending[0]!.reject(new Error("old request failed"));
      await vi.waitFor(() => expect(first).toHaveBeenCalled());
      expect(await state()).toMatchObject({ status: "ready", data: { result: { score: 82 } } });
      expect(await browser.action.getBadgeText({ tabId: 7 })).toBe("82");
    },
  );

  it("does not restore a score after the new page reports no posting", async () => {
    const first = await send("posting-found");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    await send("no-posting", "https://jobs.lever.co/bramblecrest");
    pending[0]!.resolve(data(82));
    await vi.waitFor(() => expect(first).toHaveBeenCalled());
    expect(await state()).toMatchObject({
      status: "not-a-posting",
      url: "https://jobs.lever.co/bramblecrest",
    });
  });

  it("invalidates a pending score when the tab navigates", async () => {
    const first = await send("posting-found");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    await fakeBrowser.tabs.onUpdated.trigger(7, { url: "https://careers.example/" }, {
      id: 7,
    } as NonNullable<Parameters<typeof listener>[1]["tab"]>);
    pending[0]!.resolve(data(82));
    await vi.waitFor(() => expect(first).toHaveBeenCalled());
    expect(await state()).toBeUndefined();
  });
});
