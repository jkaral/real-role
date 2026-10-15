import type { Metadata } from "next";
import { BANDS, DEFAULT_WEIGHTS } from "@real-role/scoring";
import { SIGNAL_IDS, type SignalId } from "@real-role/shared";

export const metadata: Metadata = { title: "How scoring works" };

const SIGNALS: Record<SignalId, { name: string; body: string }> = {
  posting_age: {
    name: "Posting age",
    body: "How long ago the posting was published. Roles posted in the last week score highest; after a few months the odds of active hiring drop.",
  },
  repost_history: {
    name: "Repost history",
    body: "How long Real Role users have been seeing the same role (same title, company and location). Being seen many times in a few days is normal; being listed for months is not.",
  },
  careers_page_match: {
    name: "Careers page",
    body: "Whether the same role is listed on the employer's own job board (Greenhouse, Lever or Ashby), checked through their official public APIs.",
  },
  description_specificity: {
    name: "Description detail",
    body: "Whether the description names a pay range, a team or manager, concrete duties and the hiring process, or relies on generic stock phrases. An AI review may add to the built-in checks.",
  },
  company_hiring_activity: {
    name: "Company hiring activity",
    body: "How many roles the employer lists and how recently any of them changed.",
  },
};

export default function HowItWorksPage() {
  const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">How the Freshness Score works</h1>
      <p className="mt-4 text-lg text-ink-soft">
        The Freshness Score estimates how likely a posting is to be a real, active opening. It never
        says a posting is fake. It shows its evidence so you can decide for yourself.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Five signals</h2>
      <ul className="mt-4 space-y-4">
        {SIGNAL_IDS.map((id) => (
          <li key={id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-semibold">{SIGNALS[id].name}</h3>
              <span className="text-sm tabular-nums text-muted">
                up to {Math.round((DEFAULT_WEIGHTS[id] / total) * 100)} points
              </span>
            </div>
            <p className="mt-2 text-ink-soft">{SIGNALS[id].body}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Adding it up</h2>
      <p className="mt-3 text-ink-soft">
        Each signal earns points, and the points add up exactly to the score. When a signal
        can&apos;t be checked, for example when we can&apos;t find the employer&apos;s job board, it
        isn&apos;t counted against the posting. The other signals are scaled up instead, and the{" "}
        <strong>confidence</strong> goes down.
      </p>
      <p className="mt-3 text-ink-soft">
        {BANDS.high}–100 is high freshness, {BANDS.medium}–{BANDS.high - 1} medium, and below{" "}
        {BANDS.medium} low.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What a score isn&apos;t</h2>
      <p className="mt-3 text-ink-soft">
        A low score doesn&apos;t mean an employer did anything wrong. Roles get filled, renamed or
        listed in other places. Treat the score as one input alongside your own judgment.
      </p>
    </article>
  );
}
