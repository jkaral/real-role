import Link from "next/link";
import { computeScore } from "@real-role/scoring";
import { ScoreCard } from "@/components/score-card";

// A real engine result for a fictional posting, so the example is never made up by hand.
const NOW = new Date("2026-10-15T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const example = computeScore({
  now: NOW,
  posting: {
    title: "Data Analyst",
    company: "Northwind Lumen",
    location: "Toronto, ON",
    postedAt: day(150),
    descriptionText:
      "Join the Finance Analytics team. Maintain monthly revenue dashboards, validate SQL models, and report to the analytics manager.",
    sourceUrl: "https://jobs.example/northwind-lumen/data-analyst",
    source: "generic",
    parsedBy: "example",
  },
  sightings: { count: 5, firstSeenAt: day(60), lastSeenAt: day(0) },
});

const STEPS = [
  {
    title: "Open a posting",
    body: "Browse jobs as usual. The Chrome extension reads only the page you're viewing.",
  },
  {
    title: "See the Freshness Score",
    body: "A 0–100 score with every signal behind it: age, repost history, the employer's own careers page, and how specific the description is.",
  },
  {
    title: "Track and follow up",
    body: "Save roles you apply to. Your dashboard reminds you when it's time to follow up.",
  },
];

const PRINCIPLES = [
  ["Signals, not verdicts", "We show the evidence and how confident we are. You decide."],
  ["Only what you're viewing", "No crawling job boards and no reading your browsing history."],
  ["Official sources", "Careers-page checks use employers' public job-board APIs."],
  ["Minimal data", "We store posting fingerprints and dates, plus the roles you choose to track."],
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="inline-flex rounded-full bg-brand-tint px-3 py-1 text-sm font-medium text-brand">
              For job seekers
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Is this job still hiring?
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-soft">
              Some postings stay up long after the role is filled, or get reposted for months. Real
              Role gives any posting a Freshness Score and shows you exactly why, so you can spend
              your time on openings that are likely to be real and active.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/check"
                className="rounded-lg bg-brand px-5 py-3 font-medium text-white hover:bg-brand-strong"
              >
                Check a posting
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-line bg-white px-5 py-3 font-medium hover:bg-paper"
              >
                How the score works
              </Link>
              <Link
                href="/install"
                className="rounded-lg border border-line bg-white px-5 py-3 font-medium hover:bg-paper"
              >
                Get the extension (beta)
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">Free. No account needed to check a posting.</p>
          </div>
          <div aria-label="Example result for a fictional posting">
            <ScoreCard
              result={example}
              title="Data Analyst"
              company="Northwind Lumen (fictional)"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint font-semibold text-brand">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Built to be fair and private</h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-line p-6">
                <dt className="font-semibold">{title}</dt>
                <dd className="mt-2 text-ink-soft">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
