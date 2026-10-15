import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chrome extension",
  description:
    "See a Freshness Score on job postings as you browse, with the signals behind it. Reads only the page you're viewing.",
};
export const dynamic = "force-dynamic";

const BOARDS = ["Greenhouse", "Lever", "Ashby", "Workday", "Wellfound", "Indeed", "LinkedIn"];

const FEATURES = [
  [
    "A badge on the posting",
    "A small score appears on job postings you open. Nothing runs elsewhere unless you click the toolbar icon.",
  ],
  [
    "The signals in a side panel",
    "Click the badge to see posting age, repost history, the careers-page check and description detail.",
  ],
  [
    "Save & track",
    "One click adds the role to your dashboard, with a follow-up date once you apply.",
  ],
] as const;

export default function ExtensionPage() {
  const storeUrl = process.env.EXTENSION_STORE_URL;
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="inline-flex rounded-full bg-brand-tint px-3 py-1 text-sm font-medium text-brand">
        Chrome extension
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">The score, where you browse</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Real Role adds a Freshness Score to job postings as you view them. It reads only the page
        you have open, and stores a fingerprint of the posting, never your browsing history.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {storeUrl ? (
          <a
            href={storeUrl}
            className="rounded-lg bg-brand px-5 py-3 font-medium text-on-brand hover:bg-brand-strong"
          >
            Add to Chrome, free
          </a>
        ) : (
          <span className="rounded-lg border border-dashed border-line px-5 py-3 font-medium text-muted">
            Chrome Web Store listing coming soon
          </span>
        )}
        <Link
          href="/check"
          className="rounded-lg border border-line bg-surface px-5 py-3 font-medium hover:bg-paper"
        >
          Check a posting on the web instead
        </Link>
      </div>

      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {FEATURES.map(([title, body]) => (
          <li key={title} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-ink-soft">{body}</p>
          </li>
        ))}
      </ul>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Works on</h2>
        <p className="mt-2 text-ink-soft">
          Runs automatically on {BOARDS.join(", ")}. On any other site, click the Real Role icon in
          the toolbar to check the page you&apos;re on. Some pages can&apos;t be read (for example,
          when a site hides the posting details); paste the text on the{" "}
          <Link href="/check" className="font-medium text-brand hover:underline">
            check page
          </Link>{" "}
          instead.
        </p>
      </section>

      {!storeUrl && (
        <section className="mt-12 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">Install the developer build</h2>
          <p className="mt-2 text-ink-soft">
            Until the store listing is live, you can load the extension from source:
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-soft">
            <li>
              Clone the{" "}
              <a
                href="https://github.com/jkaral/real-role"
                className="font-medium text-brand hover:underline"
              >
                Real Role repository
              </a>{" "}
              and run <code className="rounded bg-paper px-1.5 py-0.5 text-sm">pnpm install</code>.
            </li>
            <li>
              Build it:{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 text-sm">
                pnpm --filter @real-role/extension build
              </code>
            </li>
            <li>
              Open{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 text-sm">chrome://extensions</code>,
              turn on Developer mode, choose <strong>Load unpacked</strong> and select{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 text-sm">
                apps/extension/.output/chrome-mv3
              </code>
              .
            </li>
          </ol>
        </section>
      )}
    </div>
  );
}
