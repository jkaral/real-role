"use client";

import {
  API_ROUTES,
  ApiErrorSchema,
  ScoreResponseSchema,
  TEST_IDS,
  type ScoreRequest,
  type ScoreResponse,
} from "@real-role/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScoreCard } from "@/components/score-card";
import { EmployerSource } from "@/components/employer-source";
import { factsFromPosting } from "@/lib/job-preferences";
import { PriorApplication } from "@/components/prior-application";
import { InterviewBrief } from "@/components/interview-brief";

type Mode = "url" | "text";
type SaveState = "idle" | "saving" | "saved" | "signin" | "error";
type FieldErrors = Partial<Record<"url" | "text", string>>;

/** Survives the sign-in round trip in this tab, so the user comes back to their result. */
const RESUME_KEY = "rr-check-resume";
const MIN_TEXT = 50;
const SIGN_IN_HREF = `/signin?callbackUrl=${encodeURIComponent("/check?resume=1")}`;

function validate(mode: Mode, url: string, text: string): FieldErrors {
  if (mode === "text") {
    const n = text.trim().length;
    if (n === 0) return { text: "Paste the posting text." };
    if (n < MIN_TEXT)
      return { text: `Paste a bit more of the posting (at least ${MIN_TEXT} characters).` };
    return {};
  }
  const v = url.trim();
  if (!v) return { url: "Paste the link to a job posting." };
  try {
    const parsed = new URL(v);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return { url: "That doesn't look like a web link. It should start with https://" };
  }
  return {};
}

async function errorMessage(res: Response): Promise<string> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.error.message : "Something went wrong. Please try again.";
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink shadow-sm placeholder:text-muted focus:border-brand";

export function CheckForm({
  initialMode = "url",
  resume = false,
}: {
  initialMode?: Mode;
  resume?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const tabs = useRef<Record<Mode, HTMLButtonElement | null>>({ url: null, text: null });

  // Back from sign-in: restore the result and finish the save the user asked for.
  useEffect(() => {
    if (!resume) return;
    let stored: ScoreResponse | null;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      sessionStorage.removeItem(RESUME_KEY);
      const parsed = raw ? ScoreResponseSchema.safeParse(JSON.parse(raw)) : null;
      stored = parsed?.success ? parsed.data : null;
    } catch {
      stored = null;
    }
    window.history.replaceState(null, "", "/check");
    if (stored) {
      setData(stored);
      void saveApplication(stored);
    }
  }, [resume]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate(mode, url, text);
    setFieldErrors(errors);
    if (errors.url || errors.text) {
      document.getElementById(mode === "url" ? "url" : "text")?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setSave("idle");
    const body: ScoreRequest =
      mode === "url"
        ? { kind: "url", url: url.trim() }
        : {
            kind: "text",
            text,
            ...(title.trim() ? { title: title.trim() } : {}),
            ...(company.trim() ? { company: company.trim() } : {}),
          };
    try {
      const res = await fetch(API_ROUTES.score, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await errorMessage(res));
        return;
      }
      setData(ScoreResponseSchema.parse(await res.json()));
    } catch {
      setError("We couldn't reach Real Role. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function saveApplication(target: ScoreResponse) {
    setSave("saving");
    const res = await fetch("/api/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postingId: target.postingId,
        facts: factsFromPosting(target.posting),
      }),
    }).catch(() => null);
    if (res?.status === 401) {
      try {
        sessionStorage.setItem(RESUME_KEY, JSON.stringify(target));
      } catch {
        /* storage blocked: the user can check again after signing in */
      }
      setSave("signin");
    } else setSave(res?.ok ? "saved" : "error");
  }

  function switchTo(value: Mode, focus = false) {
    setMode(value);
    setFieldErrors({});
    if (focus) tabs.current[value]?.focus();
  }

  // WAI-ARIA tabs: arrows, Home and End move between tabs.
  function onTabKey(event: React.KeyboardEvent) {
    const order: Mode[] = ["url", "text"];
    const i = order.indexOf(mode);
    const next =
      event.key === "ArrowRight"
        ? order[(i + 1) % order.length]
        : event.key === "ArrowLeft"
          ? order[(i - 1 + order.length) % order.length]
          : event.key === "Home"
            ? order[0]
            : event.key === "End"
              ? order[order.length - 1]
              : undefined;
    if (!next) return;
    event.preventDefault();
    switchTo(next, true);
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      ref={(el) => {
        tabs.current[value] = el;
      }}
      aria-selected={mode === value}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      tabIndex={mode === value ? 0 : -1}
      onClick={() => switchTo(value)}
      onKeyDown={onTabKey}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        mode === value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        onSubmit={onSubmit}
        noValidate
        data-testid={TEST_IDS.web.checkForm}
        className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"
      >
        <div
          role="tablist"
          aria-label="How to check"
          className="inline-flex rounded-lg bg-paper p-1"
        >
          {tab("url", "Paste a link")}
          {tab("text", "Paste the text")}
        </div>

        {mode === "url" ? (
          <div id="panel-url" role="tabpanel" aria-labelledby="tab-url" className="mt-5">
            <label htmlFor="url" className="text-sm font-medium">
              Job posting URL
            </label>
            <input
              id="url"
              type="url"
              required
              inputMode="url"
              autoComplete="off"
              placeholder="https://jobs.example.com/platform-engineer"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={fieldErrors.url ? true : undefined}
              aria-describedby={fieldErrors.url ? "url-error url-hint" : "url-hint"}
              data-testid={TEST_IDS.web.checkUrlInput}
              className={inputClass}
            />
            {fieldErrors.url && (
              <p id="url-error" className="mt-2 text-sm font-medium text-low">
                {fieldErrors.url}
              </p>
            )}
            <p id="url-hint" className="mt-2 text-sm text-muted">
              We fetch that one page once to read it. Sites that need a login (like LinkedIn)
              can&apos;t be read this way. Paste the text instead, or use the Chrome extension.
            </p>
          </div>
        ) : (
          <div
            id="panel-text"
            role="tabpanel"
            aria-labelledby="tab-text"
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="title" className="text-sm font-medium">
                  Job title <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="company" className="text-sm font-medium">
                  Company <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="text" className="text-sm font-medium">
                Posting text
              </label>
              <textarea
                id="text"
                required
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={fieldErrors.text ? true : undefined}
                aria-describedby={fieldErrors.text ? "text-error text-hint" : "text-hint"}
                data-testid={TEST_IDS.web.checkTextInput}
                placeholder="Paste the full job description, including the posted date if shown."
                className={inputClass}
              />
              <div className="mt-2 flex items-start justify-between gap-3 text-sm">
                {fieldErrors.text ? (
                  <p id="text-error" className="font-medium text-low">
                    {fieldErrors.text}
                  </p>
                ) : (
                  <span />
                )}
                <span
                  className={`shrink-0 tabular-nums ${
                    text.trim().length >= MIN_TEXT ? "text-muted" : "text-ink-soft"
                  }`}
                  aria-hidden="true"
                >
                  {text.trim().length < MIN_TEXT
                    ? `${text.trim().length}/${MIN_TEXT}`
                    : `${text.trim().length.toLocaleString()} characters`}
                </span>
              </div>
              <p id="text-hint" className="mt-2 text-sm text-muted">
                Add the company name to include repost history. We store the extracted fields, not
                the text you paste.
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          data-testid={TEST_IDS.web.checkSubmit}
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? "Checking…" : "Check freshness"}
        </button>
      </form>

      <div aria-live="polite" aria-busy={loading}>
        {error && (
          <div
            role="alert"
            data-testid={TEST_IDS.web.checkError}
            className="rounded-2xl border border-low/30 bg-low-tint p-5 text-low"
          >
            <p>{error}</p>
            {mode === "url" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  switchTo("text");
                  // The textarea mounts on this render; focus it once it exists.
                  setTimeout(() => document.getElementById("text")?.focus(), 0);
                }}
                className="mt-3 rounded-lg border border-low/40 bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-paper"
              >
                Paste the text instead
              </button>
            )}
          </div>
        )}
        {loading && (
          <div className="animate-pulse rounded-2xl border border-line bg-surface p-6">
            <div className="flex items-center gap-5">
              <div className="h-28 w-28 rounded-full bg-line" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-1/2 rounded bg-line" />
                <div className="h-6 w-2/3 rounded bg-line" />
              </div>
            </div>
            <p className="sr-only">Checking the posting…</p>
          </div>
        )}
        {!loading && !error && !data && (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            Your score and the signals behind it will appear here.
          </div>
        )}
        {data && (
          <ScoreCard result={data.result} title={data.posting.title} company={data.posting.company}>
            <EmployerSource key={data.postingId} posting={data.posting} />
            <PriorApplication key={`prior-${data.postingId}`} postingId={data.postingId} />
            <InterviewBrief key={`brief-${data.postingId}`} posting={data.posting} />
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button
                type="button"
                onClick={() => void saveApplication(data)}
                disabled={save === "saving" || save === "saved"}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-60"
              >
                {save === "saved" ? "Saved" : save === "saving" ? "Saving…" : "Save & track"}
              </button>
              {save === "saved" && (
                <Link href="/shortlist" className="text-sm font-medium text-brand hover:underline">
                  Open personal shortlist
                </Link>
              )}
              {save === "saved" && (
                <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
                  Open dashboard
                </Link>
              )}
              {save === "signin" && (
                <p className="text-sm text-ink-soft">
                  <Link href={SIGN_IN_HREF} className="font-medium text-brand hover:underline">
                    Sign in
                  </Link>{" "}
                  to track this application. We&apos;ll bring you back here and save it.
                </p>
              )}
              {save === "error" && (
                <p className="text-sm text-low">Couldn&apos;t save. Please try again.</p>
              )}
            </div>
          </ScoreCard>
        )}
      </div>
    </div>
  );
}
