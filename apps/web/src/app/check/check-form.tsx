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
import { useState } from "react";
import { ScoreCard } from "@/components/score-card";

type Mode = "url" | "text";
type SaveState = "idle" | "saving" | "saved" | "signin" | "error";

async function errorMessage(res: Response): Promise<string> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.error.message : "Something went wrong. Please try again.";
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-ink shadow-sm placeholder:text-muted focus:border-brand";

export function CheckForm() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [save, setSave] = useState<SaveState>("idle");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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

  async function onSave() {
    if (!data) return;
    setSave("saving");
    const res = await fetch(API_ROUTES.applications, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postingId: data.postingId }),
    }).catch(() => null);
    if (res?.status === 401) setSave("signin");
    else setSave(res?.ok ? "saved" : "error");
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      onClick={() => setMode(value)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        mode === value ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        onSubmit={onSubmit}
        data-testid={TEST_IDS.web.checkForm}
        className="h-fit rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"
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
              placeholder="https://jobs.example.com/platform-engineer"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid={TEST_IDS.web.checkUrlInput}
              className={inputClass}
            />
            <p className="mt-2 text-sm text-muted">
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
                minLength={50}
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                data-testid={TEST_IDS.web.checkTextInput}
                placeholder="Paste the full job description, including the posted date if shown."
                className={inputClass}
              />
              <p className="mt-2 text-sm text-muted">
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
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
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
            {error}
          </div>
        )}
        {loading && (
          <div className="animate-pulse rounded-2xl border border-line bg-white p-6">
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
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button
                type="button"
                onClick={onSave}
                disabled={save === "saving" || save === "saved"}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft disabled:opacity-60"
              >
                {save === "saved" ? "Saved" : save === "saving" ? "Saving…" : "Save & track"}
              </button>
              {save === "saved" && (
                <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
                  Open dashboard
                </Link>
              )}
              {save === "signin" && (
                <p className="text-sm text-ink-soft">
                  <Link
                    href="/signin?callbackUrl=/check"
                    className="font-medium text-brand hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to track this application.
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
