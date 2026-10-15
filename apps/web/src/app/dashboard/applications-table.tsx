"use client";

import {
  API_ROUTES,
  APPLICATION_STATUSES,
  ApplicationResponseSchema,
  TEST_IDS,
  dashboardRowTestId,
  isFollowUpDue,
  type ApplicationStatus,
  type TrackedApplication,
} from "@real-role/shared";
import { useState } from "react";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
};

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted">—</span>;
  const tone =
    score >= 70
      ? "bg-high-tint text-high"
      : score >= 40
        ? "bg-medium-tint text-medium"
        : "bg-low-tint text-low";
  return (
    <span className={`rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${tone}`}>
      {score}
    </span>
  );
}

export function ApplicationsTable({ initial }: { initial: TrackedApplication[] }) {
  const [apps, setApps] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const due = apps.filter((a) => isFollowUpDue(a, now)).length;

  async function update(id: string, status: ApplicationStatus) {
    setError(null);
    const res = await fetch(API_ROUTES.application(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!res?.ok) return setError("Couldn't update that application. Please try again.");
    const { application } = ApplicationResponseSchema.parse(await res.json());
    setApps((list) => list.map((a) => (a.id === id ? application : a)));
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(API_ROUTES.application(id), { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("Couldn't remove that application. Please try again.");
    setApps((list) => list.filter((a) => a.id !== id));
  }

  return (
    <div className="mt-8">
      {due > 0 && (
        <p className="mb-4 rounded-lg bg-medium-tint px-4 py-3 text-sm text-medium">
          {due} application{due === 1 ? " is" : "s are"} due for a follow-up.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-low-tint px-4 py-3 text-sm text-low">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Tracked applications</caption>
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Role
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Freshness
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Applied
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Follow up
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {apps.map((a) => {
              const isDue = isFollowUpDue(a, now);
              return (
                <tr key={a.id} data-testid={dashboardRowTestId(a.id)}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {/^https?:/.test(a.sourceUrl) ? (
                        <a
                          href={a.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        a.title
                      )}
                    </p>
                    <p className="text-muted">{a.company}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ScorePill score={a.scoreAtSave} />
                  </td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`status-${a.id}`}>
                      Status for {a.title}
                    </label>
                    <select
                      id={`status-${a.id}`}
                      value={a.status}
                      onChange={(e) => update(a.id, e.target.value as ApplicationStatus)}
                      data-testid={TEST_IDS.web.dashboardStatusSelect}
                      className="rounded-md border border-line bg-surface px-2 py-1"
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{fmt(a.appliedAt)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {isDue ? (
                      <span
                        data-testid={TEST_IDS.web.dashboardFollowUpDue}
                        className="rounded-md bg-medium-tint px-2 py-0.5 font-medium text-medium"
                      >
                        Due {fmt(a.followUpAt)}
                      </span>
                    ) : (
                      fmt(a.followUpAt)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      data-testid={TEST_IDS.web.dashboardRemove}
                      className="rounded-md px-2 py-1 text-muted hover:bg-paper hover:text-low"
                    >
                      Remove<span className="sr-only"> {a.title}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
