import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { ApiFailure, scorePosting } from "@/lib/api";
import { badgeFor, tabKey, type BadgeUpdate, type Message, type TabState } from "@/lib/state";

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

async function handlePosting(
  tabId: number,
  posting: Extract<Message, { type: "posting-found" }>["posting"],
): Promise<BadgeUpdate> {
  const url = posting.sourceUrl;
  await setState(tabId, { status: "loading", url });
  try {
    const data = await scorePosting(posting);
    await setState(tabId, { status: "ready", url, data });
    return { ok: true, score: data.result.score, band: data.result.band };
  } catch (error) {
    const message =
      error instanceof ApiFailure ? error.message : "Something went wrong scoring this posting.";
    await setState(tabId, { status: "error", url, message });
    return { ok: false, message };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const message = raw as Message;
    const tabId = message.type === "check-tab" ? message.tabId : sender.tab?.id;
    if (tabId === undefined) return false;

    switch (message.type) {
      case "posting-found":
        void handlePosting(tabId, message.posting).then(sendResponse);
        return true; // async response
      case "no-posting":
        void setState(tabId, { status: "not-a-posting", url: sender.tab?.url ?? "" });
        return false;
      case "open-panel":
        // Called from the badge's click handler, so the user gesture is still active.
        void openPanel(tabId);
        return false;
      case "check-tab":
        void checkTab(tabId);
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
    if (change.url) void setState(tabId, undefined);
  });
  browser.tabs.onRemoved.addListener((tabId) => void browser.storage.session.remove(tabKey(tabId)));

  // Let the side panel (an extension page) read session storage.
  void browser.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
});
