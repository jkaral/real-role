import type { ScoreResponse } from "@real-role/shared";

/** What the extension knows about one tab. Kept in storage.session (cleared on browser restart). */
export type TabState =
  | { status: "loading"; url: string }
  | { status: "ready"; url: string; data: ScoreResponse }
  | { status: "error"; url: string; message: string }
  | { status: "not-a-posting"; url: string };

export const tabKey = (tabId: number) => `tab:${tabId}`;

/** Message from the content script or side panel to the background worker. */
export type Message =
  | { type: "posting-found"; posting: ScoreResponse["posting"] }
  | { type: "no-posting" }
  | { type: "open-panel" }
  | { type: "check-tab"; tabId: number };

/** Background → content script: read the page again (Retry, or toolbar click on a known tab). */
export type ContentMessage = { type: "recheck" };

/** Reply to "posting-found", used to update the in-page badge. */
export type BadgeUpdate =
  | { ok: true; score: number; band: ScoreResponse["result"]["band"] }
  | { ok: false; message: string };

/** Toolbar badge colours per freshness band (also used by the in-page badge). */
export const BAND_COLORS = { high: "#1d7a4f", medium: "#9a6408", low: "#a33a2b" } as const;

export function badgeFor(state: TabState | undefined): { text: string; color: string } {
  if (!state || state.status === "not-a-posting") return { text: "", color: "#64766f" };
  if (state.status === "loading") return { text: "…", color: "#64766f" };
  if (state.status === "error") return { text: "!", color: "#64766f" };
  const { score, band } = state.data.result;
  return { text: String(score), color: BAND_COLORS[band] };
}
