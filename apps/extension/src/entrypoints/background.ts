import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import type { ParsedPosting } from "@real-role/shared";
import { ApiFailure, scorePosting } from "@/lib/api";
import { validateMessage } from "@/lib/messages";
import {
  badgeFor,
  tabKey,
  type BadgeUpdate,
  type ContentMessage,
  type TabState,
} from "@/lib/state";

async function setState(tabId: number, state: TabState | undefined): Promise<void> {
  if (state) await browser.storage.session.set({ [tabKey(tabId)]: state });
  else await browser.storage.session.remove(tabKey(tabId));
  const badge = badgeFor(state);
  await browser.action.setBadgeText({ tabId, text: badge.text }).catch(() => {});
  await browser.action.setBadgeBackgroundColor({ tabId, color: badge.color }).catch(() => {});
}

/** Open the side panel for a tab; fall back to a small window if Chrome refuses. */
async function openPanel(tabId: number): Promise<void> {
  try {
    await browser.sidePanel.open({ tabId });
  } catch {
    await browser.windows.create({
      url: browser.runtime.getURL(`/sidepanel.html?tabId=${tabId}`),
      type: "popup",
      width: 420,
      height: 760,
    });
  }
}

/** Run the content script on demand (toolbar click) on sites outside the automatic list. */
async function checkTab(tabId: number): Promise<void> {
  // Already injected (automatic match or an earlier click): ask it to read the page again.
  const reached = await browser.tabs
    .sendMessage(tabId, { type: "recheck" } satisfies ContentMessage)
    .then(() => true)
    .catch(() => false);
  if (reached) return;
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["/content-scripts/content.js"],
    });
  } catch {
    const tab = await browser.tabs.get(tabId).catch(() => undefined);
    await setState(tabId, {
      status: "error",
      url: tab?.url ?? "",
      message: "Real Role can't read this page. Try opening the posting on the employer's site.",
    });
  }
}

// A retry or navigation supersedes older requests, including retries at the same URL.
const requests = new Map<number, symbol>();

async function handlePosting(tabId: number, posting: ParsedPosting): Promise<BadgeUpdate> {
  const url = posting.sourceUrl;
  const request = Symbol();
  requests.set(tabId, request);
  const isCurrent = () => requests.get(tabId) === request;
  await setState(tabId, { status: "loading", url });
  try {
    const data = await scorePosting(posting);
    if (isCurrent()) await setState(tabId, { status: "ready", url, data });
    return { ok: true, score: data.result.score, band: data.result.band };
  } catch (error) {
    const message =
      error instanceof ApiFailure ? error.message : "Something went wrong scoring this posting.";
    if (isCurrent()) await setState(tabId, { status: "error", url, message });
    return { ok: false, message };
  } finally {
    if (isCurrent()) requests.delete(tabId);
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const message = validateMessage(raw, sender, browser.runtime.id);
    if (!message) return false;

    switch (message.type) {
      case "posting-found":
        void handlePosting(message.tabId, message.posting).then(sendResponse);
        return true; // async response
      case "no-posting":
        requests.delete(message.tabId);
        void setState(message.tabId, { status: "not-a-posting", url: message.url });
        return false;
      case "open-panel":
        // Called from the badge's click handler, so the user gesture is still active.
        void openPanel(message.tabId);
        return false;
      case "check-tab":
        void checkTab(message.tabId);
        return false;
    }
  });

  // Toolbar icon: open the panel first (needs the click's user gesture), then read the page.
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    void openPanel(tab.id);
    void browser.storage.session.get(tabKey(tab.id)).then((stored) => {
      if (tab.id !== undefined && !stored[tabKey(tab.id)]) void checkTab(tab.id);
    });
  });

  // A new page in the tab invalidates what we knew; the content script reports again.
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url) {
      requests.delete(tabId);
      void setState(tabId, undefined);
    }
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    requests.delete(tabId);
    void browser.storage.session.remove(tabKey(tabId));
  });

  // Let the side panel (an extension page) read session storage.
  void browser.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
});
