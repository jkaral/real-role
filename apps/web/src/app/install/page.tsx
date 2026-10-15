import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Install the extension (beta)" };

const RELEASES_URL = "https://github.com/jkaral/real-role/releases/latest";

export default function InstallPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Install the Chrome extension (beta)</h1>
      <p className="mt-4 text-lg text-ink-soft">
        The extension shows a Freshness Score on job postings as you browse. While the Chrome Web
        Store listing is in review, you can install the beta build directly.
      </p>

      <ol className="mt-8 list-decimal space-y-4 pl-6 text-ink-soft marker:font-semibold marker:text-ink">
        <li>
          Download <code className="rounded bg-line/60 px-1">real-role-extension-…-chrome.zip</code>{" "}
          from the{" "}
          <a href={RELEASES_URL} className="font-medium text-ink underline underline-offset-2">
            latest release
          </a>{" "}
          and unzip it into a folder you&apos;ll keep.
        </li>
        <li>
          Open <code className="rounded bg-line/60 px-1">chrome://extensions</code> and turn on{" "}
          <strong>Developer mode</strong> (top right).
        </li>
        <li>
          Click <strong>Load unpacked</strong> and choose the unzipped folder (the one that contains{" "}
          <code className="rounded bg-line/60 px-1">manifest.json</code>).
        </li>
        <li>
          Pin Real Role from the puzzle-piece menu. Open a job posting and click the score badge to
          see the signals behind it.
        </li>
      </ol>

      <h2 className="mt-10 text-xl font-semibold">Updating</h2>
      <p className="mt-3 text-ink-soft">
        Unzip a newer release over the same folder, then click the reload icon on Real Role&apos;s
        card in <code className="rounded bg-line/60 px-1">chrome://extensions</code>.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What it can see</h2>
      <p className="mt-3 text-ink-soft">
        The extension reads only the job posting you have open and sends its fields to Real Role to
        compute the score. It doesn&apos;t read your browsing history. Details are in the{" "}
        <Link href="/privacy" className="font-medium text-ink underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
      <p className="mt-3 text-ink-soft">
        No extension? You can still{" "}
        <Link href="/check" className="font-medium text-ink underline underline-offset-2">
          check a posting
        </Link>{" "}
        by pasting its URL or text.
      </p>
    </article>
  );
}
