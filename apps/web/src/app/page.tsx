import Link from "next/link";
import type { AtsRole } from "@real-role/shared";
import { computeScore, type CareersEvidence, type ScoringInput } from "@real-role/scoring";
import { ExampleSwitcher, type Example } from "@/components/example-switcher";

// Real engine results for fictional postings, so the examples are never made up by hand.
const NOW = new Date("2026-10-15T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

/** A fictional Greenhouse board where the role is listed, alongside `open - 1` other roles. */
function careersMatch(token: string, title: string, open: number): CareersEvidence {
  const roles: AtsRole[] = Array.from({ length: open }, (_, i) => ({
    provider: "greenhouse",
    id: String(1000 + i),
    title: i === 0 ? title : `Role ${i}`,
    url: `https://boards.greenhouse.io/${token}/jobs/${1000 + i}`,
    updatedAt: day(i % 10),
  }));
  return {
    board: {
      provider: "greenhouse",
      boardToken: token,
      boardUrl: `https://boards.greenhouse.io/${token}`,
    },
    roles,
    match: {
      matched: true,
      role: roles[0],
      confidence: 0.95,
      method: "exact_title",
      reason: "Same title listed on the employer's board.",
    },
  };
}

function example(
  key: string,
  label: string,
  posting: Omit<ScoringInput["posting"], "source" | "parsedBy" | "sourceUrl">,
  rest: Omit<ScoringInput, "now" | "posting"> = {},
): Example {
  const result = computeScore({
    now: NOW,
    posting: {
      ...posting,
      sourceUrl: `https://jobs.example/${key}`,
      source: "generic",
      parsedBy: "example",
    },
    ...rest,
  });
  return { key, label, title: posting.title, company: `${posting.company} (fictional)`, result };
}

const EXAMPLES: Example[] = [
  example(
    "fresh",
    "Fresh",
    {
      title: "Platform Engineer",
      company: "Bramblecrest Analytics",
      location: "Remote, Canada",
      postedAt: day(3),
      salary: { min: 140_000, max: 165_000, currency: "CAD", period: "year" },
      descriptionText:
        "Join the Infrastructure team, reporting to the platform engineering manager. Own our Kubernetes clusters, build CI/CD pipelines and improve observability. Salary CA$140,000–165,000.",
    },
    {
      sightings: { count: 1, firstSeenAt: day(3), lastSeenAt: day(0) },
      careers: careersMatch("bramblecrest", "Platform Engineer", 24),
    },
  ),
  example(
    "vague",
    "Vague",
    {
      title: "Business Associate",
      company: "Harrowgate Partners",
      location: "Chicago, IL",
      postedAt: day(21),
      descriptionText:
        "We are looking for a motivated self-starter to join our dynamic team. Great culture, competitive pay and growth opportunities. Apply today!",
    },
    { sightings: { count: 2, firstSeenAt: day(21), lastSeenAt: day(0) } },
  ),
  example(
    "reposted",
    "Reposted",
    {
      title: "Data Analyst",
      company: "Northwind Lumen",
      location: "Toronto, ON",
      postedAt: day(150),
      descriptionText:
        "Join the Finance Analytics team. Maintain monthly revenue dashboards, validate SQL models, and report to the analytics manager.",
    },
    { sightings: { count: 5, firstSeenAt: day(60), lastSeenAt: day(0) } },
  ),
];

const SIGNALS = [
  {
    title: "Posting age",
    body: "How long ago it was posted, from the page or the employer's job board.",
    icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  },
  {
    title: "Repost history",
    body: "How often Real Role users have seen the same role, and over what span.",
    icon: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  },
  {
    title: "Careers page",
    body: "Whether the same role is live on the employer's own applicant-tracking board.",
    icon: "M4 7h16v12H4zM9 7V5h6v2M8 13l3 3 5-5",
  },
  {
    title: "Description detail",
    body: "Pay range, concrete duties, a named team or manager: signs of a defined opening.",
    icon: "M6 4h9l3 3v13H6zM9 11h6M9 15h6M9 7h3",
  },
  {
    title: "Hiring activity",
    body: "How many roles the employer has open, and how recently that changed.",
    icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
] as const;

const TRUST = [
  "Reads only the page you're viewing",
  "No résumé, no browsing history",
  "Official careers-page APIs",
  "Free",
];

const PRINCIPLES = [
  ["Signals, not verdicts", "We show the evidence and how confident we are. You decide."],
  ["Only what you're viewing", "No crawling job boards and no reading your browsing history."],
  ["Official sources", "Careers-page checks use employers' public job-board APIs."],
  ["Minimal data", "We store posting fingerprints and dates, plus the roles you choose to track."],
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[720px] rounded-full bg-brand-tint opacity-70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-[-10%] h-[420px] w-[520px] rounded-full bg-medium-tint opacity-60 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="lg:pt-10">
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
                href="/extension"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-medium text-on-brand shadow-card hover:bg-brand-strong"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".25" />
                  <circle cx="12" cy="12" r="4.2" fill="currentColor" />
                </svg>
                Add to Chrome, free
              </Link>
              <Link
                href="/check"
                className="rounded-lg border border-line bg-surface px-5 py-3 font-medium hover:bg-paper"
              >
                Check a posting
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      fill="none"
                      stroke="var(--color-high)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ExampleSwitcher examples={EXAMPLES} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Five signals, all visible</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Every point in the score traces back to one of these. If a signal can&apos;t be checked,
          we lower the confidence instead of guessing.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {SIGNALS.map((s, i) => (
            <li
              key={s.title}
              className={`group rounded-2xl border border-line bg-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand ${
                i < 2 ? "lg:col-span-3" : "lg:col-span-2"
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
                <Icon d={s.icon} />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ul>
        <Link
          href="/how-it-works"
          className="mt-6 inline-block font-medium text-brand hover:underline"
        >
          How the score is calculated →
        </Link>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            ["1", "Open a posting", "Browse jobs as usual. The extension reads only that page."],
            ["2", "See the score", "A 0–100 Freshness Score with every signal behind it."],
            [
              "3",
              "Track and follow up",
              "Save roles you apply to. Your dashboard flags when it's time to follow up.",
            ],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand font-semibold text-on-brand">
                {n}
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Built to be fair and private</h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          {PRINCIPLES.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6">
              <dt className="font-semibold">{title}</dt>
              <dd className="mt-2 text-ink-soft">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-brand px-8 py-10 text-on-brand sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Spend your applications well</h2>
            <p className="mt-1 opacity-90">See the score on every posting you open.</p>
          </div>
          <Link
            href="/extension"
            className="rounded-lg bg-surface px-5 py-3 font-medium text-ink hover:bg-paper"
          >
            Get the Chrome extension
          </Link>
        </div>
      </section>
    </>
  );
}
