import type { SignalId } from "./score";

/**
 * Stable `data-testid` values used by the e2e test and the demo recording.
 * Renaming one is a contract change.
 */
export const TEST_IDS = {
  extension: {
    /** Floating badge injected on posting pages. */
    badge: "rr-badge",
    badgeScore: "rr-badge-score",
    sidePanel: "rr-side-panel",
    loading: "rr-panel-loading",
    error: "rr-panel-error",
    /** Shown when the page isn't recognized as a single job posting. */
    notAPosting: "rr-panel-not-a-posting",
    score: "rr-score",
    band: "rr-band",
    confidence: "rr-confidence",
    signalList: "rr-signal-list",
    /** Text inside each signal row: label, detail, impact. */
    signalLabel: "rr-signal-label",
    signalDetail: "rr-signal-detail",
    signalImpact: "rr-signal-impact",
    saveButton: "rr-save-button",
    savedState: "rr-saved-state",
    signInPrompt: "rr-sign-in-prompt",
    openDashboard: "rr-open-dashboard",
  },
  web: {
    checkForm: "rr-check-form",
    checkUrlInput: "rr-check-url",
    checkTextInput: "rr-check-text",
    checkSubmit: "rr-check-submit",
    checkError: "rr-check-error",
    scoreCard: "rr-score-card",
    score: "rr-score",
    band: "rr-band",
    confidence: "rr-confidence",
    signalList: "rr-signal-list",
    signInButton: "rr-sign-in",
    signOutButton: "rr-sign-out",
    dashboard: "rr-dashboard",
    dashboardEmpty: "rr-dashboard-empty",
    dashboardStatusSelect: "rr-dashboard-status",
    dashboardFollowUpDue: "rr-follow-up-due",
    dashboardRemove: "rr-dashboard-remove",
  },
} as const;

/** Per-signal row, used in both the side panel and the check page. */
export const signalRowTestId = (id: SignalId): string => `rr-signal-row-${id}`;

/** Per-application dashboard row. `id` is `TrackedApplication.id`. */
export const dashboardRowTestId = (id: string): string => `rr-dashboard-row-${id}`;

/** CSS selector for a test id, for Playwright/DOM queries. */
export const byTestId = (testId: string): string => `[data-testid="${testId}"]`;
