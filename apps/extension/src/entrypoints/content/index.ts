import { parsePosting } from "@real-role/parsers";
import { TEST_IDS } from "@real-role/shared";
import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import {
  createShadowRootUi,
  type ShadowRootContentScriptUi,
} from "wxt/utils/content-script-ui/shadow-root";
import { defineContentScript } from "wxt/utils/define-content-script";
import { AUTO_MATCHES, DEMO_MATCHES } from "@/lib/config";
import { BAND_COLORS, type BadgeUpdate, type ContentMessage, type Message } from "@/lib/state";
import badgeCss from "./badge.css?inline";

declare global {
  interface Window {
    __realRoleLoaded?: boolean;
  }
}

/** Retry parsing for pages that render the posting after load. */
const RETRY_MS = [0, 1500, 4000];

function send(message: Message): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}

function renderBadge(root: HTMLElement, state: "loading" | BadgeUpdate): void {
  root.replaceChildren();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rr-badge";
  button.dataset.testid = TEST_IDS.extension.badge;
  const score = document.createElement("span");
  score.className = "rr-score";
  score.dataset.testid = TEST_IDS.extension.badgeScore;
  const label = document.createElement("span");
  label.className = "rr-label";
  label.textContent = "Freshness";

  if (state === "loading") {
    score.textContent = "…";
    button.setAttribute("aria-label", "Real Role is checking this posting");
  } else if (state.ok) {
    score.textContent = String(state.score);
    score.style.background = BAND_COLORS[state.band];
    button.setAttribute(
      "aria-label",
      `Real Role freshness score ${state.score} of 100. Open details.`,
    );
  } else {
    score.textContent = "!";
    button.setAttribute(
      "aria-label",
      `Real Role couldn't score this posting: ${state.message}. Open details.`,
    );
  }
  button.title = "Real Role: open the signal breakdown";
  button.append(score, label);
  button.addEventListener("click", () => void send({ type: "open-panel" }));
  root.append(button);
}

async function mountBadge(
  ctx: ContentScriptContext,
): Promise<ShadowRootContentScriptUi<HTMLElement>> {
  const ui = await createShadowRootUi(ctx, {
    name: "real-role-badge",
    position: "overlay",
    alignment: "bottom-right",
    zIndex: 2147483646,
    mode: "open",
    onMount: (container) => {
      // Inline styles so the badge also works where the script was injected on demand.
      const style = document.createElement("style");
      style.textContent = badgeCss;
      const root = document.createElement("div");
      container.append(style, root);
      return root;
    },
  });
  ui.mount();
  return ui;
}

export default defineContentScript({
  matches: [...AUTO_MATCHES, ...(import.meta.env.WXT_DEMO === "1" ? DEMO_MATCHES : [])],
  cssInjectionMode: "manual",
  async main(ctx) {
    // Also injected on demand from the toolbar; don't run twice.
    if (window.__realRoleLoaded) return;
    window.__realRoleLoaded = true;

    let ui: ShadowRootContentScriptUi<HTMLElement> | undefined;
    let checkedUrl = "";
    let generation = 0;

    const check = async (force = false) => {
      const url = location.href;
      if (!force && url === checkedUrl) return;
      checkedUrl = url;
      const current = ++generation;
      const isCurrent = () => current === generation && location.href === url && !ctx.isInvalid;
      ui?.remove();
      ui = undefined;

      let posting = null;
      for (const delay of RETRY_MS) {
        if (delay) await new Promise<void>((r) => ctx.setTimeout(r, delay));
        if (!isCurrent()) return;
        // Read only this page's DOM (A2). Nothing leaves the browser unless it's a posting.
        posting = parsePosting(document, url);
        if (posting) break;
      }

      if (!posting) {
        await send({ type: "no-posting" });
        return;
      }

      const mounted = await mountBadge(ctx);
      if (!isCurrent()) {
        mounted.remove();
        return;
      }
      ui = mounted;
      const root = ui.mounted;
      if (root) renderBadge(root, "loading");
      try {
        const update = (await send({ type: "posting-found", posting })) as BadgeUpdate | undefined;
        if (root && isCurrent())
          renderBadge(
            root,
            update ?? { ok: false, message: "Couldn't score this posting. Try checking again." },
          );
      } catch {
        if (root && isCurrent())
          renderBadge(root, {
            ok: false,
            message: "Couldn't reach Real Role. Try checking again.",
          });
      }
    };

    // Listen before the initial async parse/score so navigation and retries cannot be missed.
    // Job boards are often single-page apps: re-check when the URL changes.
    ctx.addEventListener(window, "wxt:locationchange", () => {
      // WXT's Navigation API event fires before location.href commits.
      ctx.setTimeout(() => void check(), 0);
    });
    // Retry from the side panel or the toolbar: read this page again.
    const onMessage = (message: unknown, sender: { id?: string }) => {
      if (sender.id !== browser.runtime.id) return;
      if ((message as ContentMessage | undefined)?.type !== "recheck") return;
      void check(true);
      return Promise.resolve(true);
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      generation++;
      browser.runtime.onMessage.removeListener(onMessage);
      ui?.remove();
    });
    await check();
  },
});
