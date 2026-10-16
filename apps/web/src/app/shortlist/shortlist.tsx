"use client";
import Link from "next/link";
import { useState } from "react";
import type { TrackedApplication } from "@real-role/shared";
import {
  assessFit,
  JobPreferencesSchema,
  type JobPreferences,
  type JobFacts,
} from "@/lib/job-preferences";

const field = "mt-1 block w-full rounded-lg border border-field bg-surface px-3 py-2";
type Initial = {
  applications: TrackedApplication[];
  facts: Record<string, JobFacts>;
  preferences: JobPreferences;
};
export function Shortlist({ initial }: { initial: Initial }) {
  const [preferences, setPreferences] = useState(initial.preferences);
  const [draft, setDraft] = useState(initial.preferences);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const set = <K extends keyof JobPreferences>(key: K, value: JobPreferences[K]) =>
    setDraft((p) => ({ ...p, [key]: value }));
  async function save(clear = false) {
    const parsed = JobPreferencesSchema.safeParse(draft);
    if (!clear && !parsed.success) {
      setMessage(
        "Check your preferences. Salary must be nonnegative and experience a whole number from 0 to 60.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/job-preferences", {
        method: clear ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        ...(clear ? {} : { body: JSON.stringify(parsed.data) }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error();
      const value = JobPreferencesSchema.parse((await res.json()).preferences);
      setPreferences(value);
      setDraft(value);
      setMessage(clear ? "Preferences cleared." : "Preferences saved across your devices.");
    } catch {
      setMessage("Could not save preferences. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const ranked = initial.applications
    .filter((a) => ["saved", "applied", "interviewing"].includes(a.status))
    .map((application) => ({
      application,
      fit: assessFit(application.title, initial.facts[application.id] ?? {}, preferences),
    }))
    .sort(
      (a, b) =>
        a.fit.mismatched.length - b.fit.mismatched.length ||
        b.fit.matched.length - a.fit.matched.length ||
        (b.application.scoreAtSave ?? -1) - (a.application.scoreAtSave ?? -1),
    );
  return (
    <>
      <form
        className="mt-6 rounded-2xl border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <legend className="font-semibold">Optional preferences</legend>
          <p className="mt-1 text-sm text-muted">
            Saved to your account until cleared. Pay is compared only in the same currency and pay
            period. A matching upper range means the role may meet your minimum, not a pay
            guarantee.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              Job titles (comma separated)
              <input
                className={field}
                maxLength={300}
                value={draft.titles}
                onChange={(e) => set("titles", e.target.value)}
              />
            </label>
            <label>
              Location contains
              <input
                className={field}
                maxLength={200}
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </label>
            <label>
              Workplace
              <select
                className={field}
                value={draft.remote}
                onChange={(e) => set("remote", e.target.value as JobPreferences["remote"])}
              >
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="onsite">Not fully remote</option>
              </select>
            </label>
            <label>
              Employment type
              <input
                className={field}
                maxLength={60}
                placeholder="e.g. full time"
                value={draft.employmentType}
                onChange={(e) => set("employmentType", e.target.value)}
              />
            </label>
            <label>
              Minimum pay
              <input
                className={field}
                type="number"
                min="0"
                value={draft.salaryMin ?? ""}
                onChange={(e) =>
                  set("salaryMin", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </label>
            <label>
              Currency
              <input
                className={field}
                maxLength={3}
                value={draft.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Pay period
              <select
                className={field}
                value={draft.period}
                onChange={(e) => set("period", e.target.value as JobPreferences["period"])}
              >
                {["hour", "day", "week", "month", "year"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Your years of experience
              <input
                className={field}
                type="number"
                min="0"
                max="60"
                step="1"
                value={draft.experienceYears ?? ""}
                onChange={(e) =>
                  set("experienceYears", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button className="rounded-lg bg-brand px-4 py-2 text-on-brand" type="submit">
              {busy ? "Saving…" : "Save preferences"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-line px-4 py-2"
              onClick={() => void save(true)}
            >
              Clear preferences
            </button>
          </div>
        </fieldset>
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      </form>
      <p className="mt-5 text-sm text-muted">
        Order: fewer mismatches, more matched preferences, then freshness at save. Closed outcomes
        are omitted. Older or manually added items can lack disclosed facts.{" "}
        <Link href="/check" className="text-brand underline">
          Check and save an opening
        </Link>{" "}
        ·{" "}
        <Link href="/dashboard" className="text-brand underline">
          Manage applications
        </Link>
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {ranked.map(({ application: a, fit }) => (
          <li key={a.id} className="rounded-xl border border-line bg-surface p-5">
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                disabled={!selected.includes(a.id) && selected.length >= 3}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked ? [...ids, a.id].slice(0, 3) : ids.filter((id) => id !== a.id),
                  )
                }
              />
              Compare {a.title} at {a.company}
            </label>
            <h2 className="font-semibold">{a.title}</h2>
            <p>{a.company}</p>
            <p className="mt-2">
              Freshness at save: {a.scoreAtSave === null ? "Not checked" : `${a.scoreAtSave}/100`} ·{" "}
              {a.confidenceAtSave ? `${a.confidenceAtSave} confidence` : "Confidence unavailable"}
            </p>
            <p>
              Fit: {fit.matched.length} matched · {fit.mismatched.length} mismatched ·{" "}
              {fit.unknown.length} unknown
            </p>
            {fit.matched.length > 0 && (
              <p className="mt-2 text-sm">Matches: {fit.matched.join(", ")}</p>
            )}
            {fit.mismatched.length > 0 && (
              <p className="mt-2 text-sm">Mismatches: {fit.mismatched.join(", ")}</p>
            )}
            {fit.unknown.length > 0 && (
              <p className="mt-2 text-sm text-muted">Unknown: {fit.unknown.join(", ")}</p>
            )}
            {fit.matched.length + fit.mismatched.length + fit.unknown.length === 0 && (
              <p className="mt-2 text-sm">No preferences set; fit has not been assessed.</p>
            )}
            {/^https?:\/\//.test(a.sourceUrl) && (
              <a
                className="mt-3 inline-block text-brand underline"
                href={a.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open saved posting
              </a>
            )}
          </li>
        ))}
      </ul>
      <section aria-label="Job comparison" className="mt-6">
        <h2 className="text-xl font-semibold">Compare saved openings</h2>
        <p className="mt-2 text-sm text-muted">
          Choose two or three openings above. Facts were captured when you saved the posting; they
          are not live status checks. Unknown means the fact was not disclosed or could not be
          extracted. Different currencies and pay periods are shown as reported, without conversion.
        </p>
        {selected.length >= 2 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Selected openings, side by side</caption>
              <thead>
                <tr>
                  <th className="p-3">Detail</th>
                  {selected.map((id) => (
                    <th key={id} className="min-w-44 p-3">
                      {initial.applications.find((a) => a.id === id)?.title}
                      <br />
                      {initial.applications.find((a) => a.id === id)?.company}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  "Freshness at save",
                  "Location",
                  "Workplace",
                  "Employment type",
                  "Disclosed pay",
                  "Minimum experience",
                  "Your fit",
                ].map((label) => (
                  <tr key={label} className="border-t border-line">
                    <th className="p-3">{label}</th>
                    {selected.map((id) => {
                      const a = initial.applications.find((v) => v.id === id)!;
                      const f = initial.facts[id] ?? {};
                      const fit = assessFit(a.title, f, preferences);
                      const pay = f.salary;
                      const values: Record<string, string> = {
                        "Freshness at save":
                          a.scoreAtSave === null
                            ? "Unknown"
                            : `${a.scoreAtSave}/100 (${a.confidenceAtSave ?? "unknown"} confidence)`,
                        Location: f.location ?? "Unknown",
                        Workplace:
                          f.remote === undefined
                            ? "Unknown"
                            : f.remote
                              ? "Remote"
                              : "Not fully remote",
                        "Employment type": f.employmentType ?? "Unknown",
                        "Disclosed pay": pay
                          ? `${pay.min ?? "?"}–${pay.max ?? "?"} ${pay.currency ?? "currency unknown"}/${pay.period ?? "period unknown"}`
                          : "Unknown",
                        "Minimum experience":
                          f.experienceMinYears === undefined
                            ? "Unknown"
                            : `${f.experienceMinYears} years`,
                        "Your fit": `${fit.matched.length} matched, ${fit.mismatched.length} mismatched, ${fit.unknown.length} unknown`,
                      };
                      return (
                        <td key={id} className="p-3 align-top">
                          {values[label]}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {ranked.length === 0 && <p className="mt-6">Save an opening to start your shortlist.</p>}
    </>
  );
}
