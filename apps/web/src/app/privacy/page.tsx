import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-3 [&_p]:text-ink-soft [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-ink-soft">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p>Last updated 15 October 2026.</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Job postings you check.</strong> The extracted fields (title, company, location,
          posted date, the posting&apos;s URL and source) and a fingerprint used to recognize
          reposts. We don&apos;t store the description text.
        </li>
        <li>
          <strong>From the Chrome extension:</strong> the same posting fields, read from the job
          posting page you&apos;re viewing, either on supported job boards (Greenhouse, Lever,
          Ashby, Workday, Wellfound, Indeed and LinkedIn job pages) or on any page after you click
          the Real Role icon. The posting text is sent to compute the score and isn&apos;t stored.
        </li>
        <li>
          <strong>Anonymous sightings.</strong> When a posting page is checked, we record that the
          role was seen on that URL that day. Sightings aren&apos;t linked to you or your account.
        </li>
        <li>
          <strong>Your tracked applications</strong>, if you sign in: the postings you save, their
          status, dates and any notes you add.
        </li>
        <li>
          <strong>Your account</strong>, if you sign in with GitHub: your GitHub display name and
          account id. We don&apos;t store your email address or avatar.
        </li>
      </ul>

      <h2>What we don&apos;t collect</h2>
      <ul>
        <li>
          Your browsing history. The extension reads only the job posting page you&apos;re viewing.
        </li>
        <li>Résumés, cover letters or other documents.</li>
        <li>Advertising or analytics trackers.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to compute Freshness Scores and run your dashboard. A posting&apos;s description may be
        sent to Anthropic&apos;s Claude API to rate how specific it is; the result is cached by
        fingerprint. We check employers&apos; public job boards (Greenhouse, Lever, Ashby) through
        their official APIs. We don&apos;t sell or share your data.
      </p>

      <h2>Your choices</h2>
      <p>
        You can remove any tracked application from your dashboard at any time. To delete your
        account and all your tracked applications, open an issue at github.com/jkaral/real-role or
        contact the maintainer, and we&apos;ll delete them.
      </p>
    </article>
  );
}
