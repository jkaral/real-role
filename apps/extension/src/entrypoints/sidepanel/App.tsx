import {
  TEST_IDS,
  signalRowTestId,
  type ScoreResponse,
  type Signal,
  type TrackedApplication,
} from "@real-role/shared";
import { BAND_LABELS, CONFIDENCE_LABELS, summarize } from "@real-role/scoring";
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
  ApiFailure,
  dashboardUrl,
  findTracked,
  pasteTextUrl,
  saveApplication,
  signInUrl,
} from "@/lib/api";
import { BAND_COLORS, tabKey, type Message, type TabState } from "@/lib/state";
import { EmployerSource } from "./EmployerSource";

type SaveState = "idle" | "saving" | "saved" | "signin" | "error";

/** `?tabId=` lets the panel render standalone (fallback window, demo recording). */
function fixedTabId(): number | null {
  const v = new URLSearchParams(location.search).get("tabId");
  return v && /^\d+$/.test(v) ? Number(v) : null;
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

function useTabState() {
  const [tabId, setTabId] = useState<number | null>(fixedTabId());
  const [state, setState] = useState<TabState | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (fixedTabId() !== null) return;
    void activeTabId().then(setTabId);
    const onActivated = (info: { tabId: number }) => setTabId(info.tabId);
    browser.tabs.onActivated.addListener(onActivated);
    return () => browser.tabs.onActivated.removeListener(onActivated);
  }, []);

  useEffect(() => {
    if (tabId === null) return;
    const key = tabKey(tabId);
    setLoaded(false);
    void browser.storage.session.get(key).then((s) => {
      setState(s[key] as TabState | undefined);
      setLoaded(true);
    });
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === "session" && key in changes)
        setState(changes[key]?.newValue as TabState | undefined);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, [tabId]);

  return { tabId, state, loaded };
}

function SignalRow({ signal }: { signal: Signal }) {
  const pct = signal.maxImpact > 0 ? (signal.impact / signal.maxImpact) * 100 : 0;
  return (
    <li className="signal" data-testid={signalRowTestId(signal.id)}>
      <div className="signal-head">
        <span className="signal-label" data-testid={TEST_IDS.extension.signalLabel}>
          {signal.label}
        </span>
        <span className="signal-impact" data-testid={TEST_IDS.extension.signalImpact}>
          {signal.available ? (
            <>
              <strong>+{signal.impact}</strong> of {signal.maxImpact}
            </>
          ) : (
            "Not counted"
          )}
        </span>
      </div>
      <p className="signal-detail" data-testid={TEST_IDS.extension.signalDetail}>
        {signal.detail}
      </p>
      {signal.available && (
        <div className="bar" aria-hidden="true">
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
      <details className="why">
        <summary>Why this matters</summary>
        <p className="muted small">{signal.explanation}</p>
      </details>
    </li>
  );
}

const STATUS_LABELS: Record<TrackedApplication["status"], string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
};

function trackedLine(app: TrackedApplication): string {
  const date = app.appliedAt ?? app.savedAt;
  const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(date),
  );
  return `${STATUS_LABELS[app.status]} · ${app.appliedAt ? "applied" : "saved"} ${when}`;
}

function Result({ data }: { data: ScoreResponse }) {
  const { result, posting } = data;
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [tracked, setTracked] = useState<TrackedApplication | null>(null);
  const unavailable = result.signals.filter((s) => !s.available).length;

  // Already on the dashboard? Then show that instead of offering to save again.
  useEffect(() => {
    let live = true;
    void findTracked(data.postingId).then((app) => {
      if (live && app) {
        setTracked(app);
        setSave("saved");
      }
    });
    return () => {
      live = false;
    };
  }, [data.postingId]);

  const onSave = useCallback(async () => {
    setSave("saving");
    try {
      const res = await saveApplication(data.postingId, undefined, data.posting);
      if (res.status === "saved") {
        setTracked(res.application);
        setSave("saved");
      } else setSave("signin");
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Couldn't save. Please try again.");
      setSave("error");
    }
  }, [data.postingId]);

  return (
    <>
      <header className="result-head">
        <div className="ring" style={{ borderColor: BAND_COLORS[result.band] }}>
          <span data-testid={TEST_IDS.extension.score}>{result.score}</span>
        </div>
        <div>
          <p className="muted small truncate">
            {posting.title} · {posting.company}
          </p>
          <p
            className="band"
            data-testid={TEST_IDS.extension.band}
            style={{ color: BAND_COLORS[result.band] }}
          >
            {BAND_LABELS[result.band]}
          </p>
          <p className="muted small" data-testid={TEST_IDS.extension.confidence}>
            {CONFIDENCE_LABELS[result.confidence]}
            {unavailable > 0 && ` · ${unavailable} unavailable`}
          </p>
        </div>
      </header>
      <p className="summary">{summarize(result)}</p>
      <EmployerSource key={data.postingId} posting={posting} />

      <div className="actions">
        {save === "saved" ? (
          <p className="saved" data-testid={TEST_IDS.extension.savedState} role="status">
            {tracked ? `On your dashboard: ${trackedLine(tracked)}.` : "Saved to your dashboard."}{" "}
            <a
              href={dashboardUrl()}
              target="_blank"
              rel="noreferrer"
              data-testid={TEST_IDS.extension.openDashboard}
            >
              Open dashboard
            </a>
          </p>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={onSave}
            disabled={save === "saving"}
            data-testid={TEST_IDS.extension.saveButton}
          >
            {save === "saving" ? "Saving…" : "Save & track"}
          </button>
        )}
        {save === "signin" && (
          <p className="notice" data-testid={TEST_IDS.extension.signInPrompt} role="status">
            <a href={signInUrl()} target="_blank" rel="noreferrer">
              Sign in to Real Role
            </a>{" "}
            to track this application, then press Save again.
          </p>
        )}
        {save === "error" && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <ul className="signals" data-testid={TEST_IDS.extension.signalList}>
        {result.signals.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </ul>
    </>
  );
}

export function App() {
  const { tabId, state, loaded } = useTabState();
  const checkPage = () =>
    tabId !== null &&
    void browser.runtime.sendMessage({ type: "check-tab", tabId } satisfies Message);

  let body: React.ReactNode;
  if (!loaded) {
    body = null;
  } else if (!state) {
    body = (
      <div className="empty">
        <p>Open a job posting to see its Freshness Score.</p>
        <p className="muted small">
          Real Role reads only the page you&apos;re on, and only when it&apos;s a job posting or you
          ask it to.
        </p>
        <button type="button" className="secondary" onClick={checkPage}>
          Check this page
        </button>
      </div>
    );
  } else if (state.status === "loading") {
    body = (
      <p className="muted" data-testid={TEST_IDS.extension.loading} role="status">
        Checking this posting…
      </p>
    );
  } else if (state.status === "error") {
    body = (
      <div className="stack">
        <p className="error" data-testid={TEST_IDS.extension.error} role="alert">
          {state.message}
        </p>
        <button type="button" className="secondary" onClick={checkPage}>
          Try again
        </button>
        <p className="muted small">
          Still not working?{" "}
          <a href={pasteTextUrl()} target="_blank" rel="noreferrer">
            Paste the posting text on the Real Role website
          </a>
          .
        </p>
      </div>
    );
  } else if (state.status === "not-a-posting") {
    body = (
      <div className="empty" data-testid={TEST_IDS.extension.notAPosting}>
        <p>This page doesn&apos;t look like a single job posting.</p>
        <p className="muted small">
          Open the posting itself. If you&apos;re already on it, the site may hide the details from
          extensions.
        </p>
        <div className="stack">
          <button type="button" className="secondary" onClick={checkPage}>
            Check this page again
          </button>
          <a className="link-button" href={pasteTextUrl()} target="_blank" rel="noreferrer">
            Paste the posting text instead
          </a>
        </div>
      </div>
    );
  } else {
    body = <Result key={state.data.postingId} data={state.data} />;
  }

  return (
    <main className="panel" data-testid={TEST_IDS.extension.sidePanel} aria-live="polite">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          ✓
        </span>
        Real Role
      </div>
      {body}
      <footer className="muted small">
        Reads only this page. Signals, not verdicts; scores are estimates.
      </footer>
    </main>
  );
}
