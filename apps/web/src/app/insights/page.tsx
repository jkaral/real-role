import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APPLICATION_STATUSES, isFollowUpDue } from "@real-role/shared";
import { auth } from "@/auth";
import { getDb } from "@/db/client";
import { readInsights } from "@/server/insights";

export const metadata: Metadata = { title: "Search insights" };
export const dynamic = "force-dynamic";
export default async function InsightsPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/insights");
  const { applications, events } = await readInsights(getDb(), userId);
  const now = new Date(),
    cutoff = now.getTime() - 7 * 86400000;
  const recent = events.filter(
    (e) => !e.baseline && e.changedAt.getTime() >= cutoff && e.changedAt <= now,
  );
  const sources = new Map<string, { total: number; interview: number }>();
  const interviewed = new Set(
    events.filter((e) => !e.baseline && e.toStatus === "interviewing").map((e) => e.applicationId),
  );
  for (const app of applications) {
    let source = "Pasted/manual";
    try {
      const url = new URL(app.sourceUrl);
      if (["https:", "http:"].includes(url.protocol)) source = url.hostname;
    } catch {
      /* Pasted/manual entries have no web source. */
    }
    const count = sources.get(source) ?? { total: 0, interview: 0 };
    count.total++;
    if (interviewed.has(app.id)) count.interview++;
    sources.set(source, count);
  }
  const labels = (v: string) => v.replaceAll("_", " ");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Your search insights</h1>
      <p className="mt-2 text-ink-soft">
        Your own tracking data, with sample sizes. These counts describe your records; they do not
        show that a source or freshness score caused an outcome.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Tracked applications", applications.length],
          [
            "Saved in the last 7 days",
            applications.filter(
              (a) => Date.parse(a.savedAt) >= cutoff && Date.parse(a.savedAt) <= now.getTime(),
            ).length,
          ],
          ["Follow-ups due", applications.filter((a) => isFollowUpDue(a, now)).length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-5">
            <p className="text-muted">{label}</p>
            <p className="text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Current status counts</h2>
        <p className="mt-2 text-sm text-muted">
          Each application appears once here. These are current states, not a historical conversion
          funnel.
        </p>
        <dl className="mt-3 flex flex-wrap gap-4">
          {APPLICATION_STATUSES.map((status) => (
            <div key={status} className="rounded border border-line p-3">
              <dt className="capitalize">{labels(status)}</dt>
              <dd>
                {applications.filter((a) => a.status === status).length} / {applications.length}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Weekly review: last 7 days</h2>
        <p className="mt-2">
          {recent.length} recorded events across {new Set(recent.map((e) => e.applicationId)).size}{" "}
          applications.{" "}
          {
            new Set(recent.filter((e) => e.toStatus === "interviewing").map((e) => e.applicationId))
              .size
          }{" "}
          applications entered interviewing.
        </p>
        <p className="mt-2 text-sm text-muted">
          Older records start with an explicitly labelled baseline. Earlier transitions are unknown.
          Initial saves/imports are events too; repeated status changes are not separate
          applications.
        </p>
        <ul className="mt-3 space-y-2">
          {recent.slice(0, 20).map((event) => (
            <li key={event.id} className="rounded border border-line p-3">
              {applications.find((a) => a.id === event.applicationId)?.title}:{" "}
              {event.fromStatus ? `${labels(event.fromStatus)} → ` : "Initial record → "}
              {labels(event.toStatus)} · {event.changedAt.toLocaleDateString()}
            </li>
          ))}
        </ul>
        {recent.length > 20 && (
          <p className="mt-2 text-sm text-muted">Showing the latest 20 events.</p>
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Sources in your records</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Saved source</th>
                <th className="p-3">Tracked</th>
                <th className="p-3">With a recorded interview event</th>
              </tr>
            </thead>
            <tbody>
              {[...sources].map(([source, count]) => (
                <tr key={source} className="border-t border-line">
                  <td className="p-3">{source}</td>
                  <td className="p-3">{count.total}</td>
                  <td className="p-3">
                    {count.interview} / {count.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-muted">
          Unknown prior history is excluded from interview-event counts. Small samples and
          incomplete tracking limit comparisons. No automatic email digest is enabled.
        </p>
      </section>
      <p className="mt-6">
        <Link className="text-brand underline" href="/dashboard">
          Manage applications
        </Link>{" "}
        ·{" "}
        <Link className="text-brand underline" href="/shortlist">
          Personal shortlist
        </Link>
      </p>
    </div>
  );
}
