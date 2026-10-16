// @vitest-environment jsdom
import type { ParsedPosting } from "@real-role/shared";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  send: vi.fn(),
  addMessage: vi.fn(),
  removeMessage: vi.fn(),
  mount: vi.fn(),
}));
vi.mock("@real-role/parsers", () => ({ parsePosting: mocks.parse }));
vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      id: "real-role-test",
      sendMessage: mocks.send,
      onMessage: { addListener: mocks.addMessage, removeListener: mocks.removeMessage },
    },
  },
}));
vi.mock("wxt/utils/content-script-ui/shadow-root", () => ({ createShadowRootUi: mocks.mount }));
import content from "../src/entrypoints/content/index";

const posting: ParsedPosting = {
  title: "Platform Engineer",
  company: "Bramblecrest Analytics",
  descriptionText: "Own deployment pipelines.",
  sourceUrl: "http://localhost/jobs/first",
  source: "generic",
  parsedBy: "jsonld",
};
let ctx: ContentScriptContext;
let invalidate: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  delete window.__realRoleLoaded;
  history.replaceState(null, "", "/jobs/first");
  const events: (() => void)[] = [];
  ctx = {
    isInvalid: false,
    setTimeout: (fn: () => void, delay: number) => window.setTimeout(fn, delay),
    addEventListener: (target: Window, event: string, fn: EventListener) => {
      target.addEventListener(event, fn);
      events.push(() => target.removeEventListener(event, fn));
    },
    onInvalidated: (fn: () => void) => {
      invalidate = () => {
        events.forEach((remove) => remove());
        fn();
      };
    },
  } as unknown as ContentScriptContext;
  mocks.mount.mockImplementation(async () => ({
    mounted: document.createElement("div"),
    mount: vi.fn(),
    remove: vi.fn(),
  }));
  mocks.send.mockResolvedValue({ ok: true, score: 82, band: "high" });
});
afterEach(() => {
  invalidate?.();
  vi.useRealTimers();
});

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("content navigation", () => {
  it("observes navigation while the initial parse is waiting for page content", async () => {
    mocks.parse
      .mockReturnValueOnce(null)
      .mockImplementation((_, url: string) => ({ ...posting, sourceUrl: url }));
    const first = content.main(ctx);
    history.pushState(null, "", "/jobs/second");
    window.dispatchEvent(new Event("wxt:locationchange"));
    await flush();
    expect(mocks.send).toHaveBeenCalledWith({
      type: "posting-found",
      posting: expect.objectContaining({ sourceUrl: location.href }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    await first;
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("waits for the URL to commit when navigation is announced before pushState", async () => {
    mocks.parse.mockImplementation((_, url: string) => ({ ...posting, sourceUrl: url }));
    await content.main(ctx);
    window.dispatchEvent(new Event("wxt:locationchange"));
    history.pushState(null, "", "/jobs/second");
    await flush();
    expect(mocks.send).toHaveBeenLastCalledWith({
      type: "posting-found",
      posting: expect.objectContaining({ sourceUrl: location.href }),
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("removes an obsolete badge if mounting finishes after a retry", async () => {
    mocks.parse.mockReturnValue(posting);
    let finish!: (value: unknown) => void;
    mocks.mount.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = content.main(ctx);
    await flush();
    const onMessage = mocks.addMessage.mock.calls[0]![0] as (
      raw: unknown,
      sender: { id: string },
    ) => Promise<boolean>;
    await onMessage({ type: "recheck" }, { id: "real-role-test" });
    await flush();
    const obsolete = { mounted: document.createElement("div"), mount: vi.fn(), remove: vi.fn() };
    finish(obsolete);
    await first;
    expect(obsolete.remove).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("lets same-URL retries supersede a pending score without repainting the new badge", async () => {
    mocks.parse.mockReturnValue(posting);
    let finish!: (value: unknown) => void;
    mocks.send.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = content.main(ctx);
    await flush();
    const onMessage = mocks.addMessage.mock.calls[0]![0] as (
      raw: unknown,
      sender: { id: string },
    ) => Promise<boolean>;
    await onMessage({ type: "recheck" }, { id: "real-role-test" });
    await flush();
    const latest = await mocks.mount.mock.results[1]!.value;
    expect(latest.mounted.textContent).toContain("82");
    finish({ ok: true, score: 19, band: "low" });
    await first;
    expect(latest.mounted.textContent).toContain("82");
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
});
