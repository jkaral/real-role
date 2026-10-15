"use client";

import {
  API_ROUTES,
  APPLICATION_STATUSES,
  ApplicationResponseSchema,
  PASTED_TEXT_URL,
  TEST_IDS,
  dashboardRowTestId,
  defaultFollowUpAt,
  isFollowUpDue,
  type ApplicationStatus,
  type CreateApplicationRequest,
  type TrackedApplication,
  type UpdateApplicationRequest,
} from "@real-role/shared";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
};

const STATUS_TONES: Record<ApplicationStatus, string> = {
  saved: "border-line",
  applied: "border-brand/50",
  interviewing: "border-high/60",
  offer: "border-high",
  rejected: "border-low/40",
  withdrawn: "border-line",
  no_response: "border-medium/40",
};

const CLOSED: readonly ApplicationStatus[] = ["offer", "rejected", "withdrawn"];

type Filter = "all" | "due" | "saved" | "applied" | "interviewing" | "closed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Follow-up due" },
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "interviewing", label: "Interviewing" },
  { id: "closed", label: "Closed" },
];

type Sort = "saved" | "followUp" | "freshness";
const SORTS: Record<Sort, string> = {
  saved: "Recently saved",
  followUp: "Follow-up date",
  freshness: "Freshness",
};

const UNDO_MS = 6000;
const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");
/** ISO timestamp → value for <input type="date"> in the user's time zone. */
const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** <input type="date"> value → ISO at 9:00 local, a sensible reminder time. */
const fromDateInput = (v: string) => (v ? new Date(`${v}T09:00:00`).toISOString() : null);

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted">—</span>;
  const [tone, label] =
    score >= 70
      ? ["bg-high-tint text-high", "High"]
      : score >= 40
        ? ["bg-medium-tint text-medium", "Medium"]
        : ["bg-low-tint text-low", "Low"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${tone}`}
    >
      {score}
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
}

function matches(a: TrackedApplication, filter: Filter, query: string, now: Date): boolean {
  if (query) {
    const q = query.toLowerCase();
    if (!a.title.toLowerCase().includes(q) && !a.company.toLowerCase().includes(q)) return false;
  }
  switch (filter) {
    case "all":
      return true;
    case "due":
      return isFollowUpDue(a, now);
    case "closed":
      return CLOSED.includes(a.status);
    default:
      return a.status === filter;
  }
}

function compare(sort: Sort) {
  return (a: TrackedApplication, b: TrackedApplication) => {
    if (sort === "freshness") return (b.scoreAtSave ?? -1) - (a.scoreAtSave ?? -1);
    if (sort === "followUp") {
      const x = a.followUpAt ? Date.parse(a.followUpAt) : Infinity;
      const y = b.followUpAt ? Date.parse(b.followUpAt) : Infinity;
      return x - y;
    }
    return Date.parse(b.savedAt) - Date.parse(a.savedAt);
  };
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 placeholder:text-muted focus:border-brand";

export function ApplicationsTable({ initial }: { initial: TrackedApplication[] }) {
  const [apps, setApps] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("saved");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ app: TrackedApplication; index: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  const due = apps.filter((a) => isFollowUpDue(a, now)).length;
  const active = apps.filter((a) => !CLOSED.includes(a.status)).length;
  const scored = apps.filter((a) => a.scoreAtSave !== null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, a) => s + (a.scoreAtSave ?? 0), 0) / scored.length)
    : null;
  const appliedThisWeek = apps.filter(
    (a) => a.appliedAt && now.getTime() - Date.parse(a.appliedAt) < 7 * 86_400_000,
  ).length;

  const visible = useMemo(
    () => apps.filter((a) => matches(a, filter, query.trim(), new Date())).sort(compare(sort)),
    [apps, filter, query, sort],
  );
  const open = apps.find((a) => a.id === openId) ?? null;

  // "/" focuses search, like most dashboards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || t?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A removal still waiting out its undo window is sent if the user leaves the page.
  useEffect(() => {
    if (!pending) return;
    const flush = () =>
      void fetch(API_ROUTES.application(pending.app.id), { method: "DELETE", keepalive: true });
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [pending]);

  async function patch(id: string, body: UpdateApplicationRequest): Promise<boolean> {
    setError(null);
    const res = await fetch(API_ROUTES.application(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't update that application. Please try again.");
      return false;
    }
    const { application } = ApplicationResponseSchema.parse(await res.json());
    setApps((list) => list.map((a) => (a.id === id ? application : a)));
    return true;
  }

  async function commitDelete(app: TrackedApplication, index: number) {
    const res = await fetch(API_ROUTES.application(app.id), { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't remove that application. It's back in your list.");
      setApps((list) => [...list.slice(0, index), app, ...list.slice(index)]);
    }
  }

  function remove(app: TrackedApplication) {
    if (timer.current) clearTimeout(timer.current);
    if (pending) void commitDelete(pending.app, pending.index);
    const index = apps.findIndex((a) => a.id === app.id);
    setApps((list) => list.filter((a) => a.id !== app.id));
    setOpenId(null);
    setPending({ app, index });
    timer.current = setTimeout(() => {
      void commitDelete(app, index);
      setPending(null);
    }, UNDO_MS);
  }

  function undo() {
    if (!pending) return;
    if (timer.current) clearTimeout(timer.current);
    const { app, index } = pending;
    setApps((list) => [...list.slice(0, index), app, ...list.slice(index)]);
    setPending(null);
  }

  function markFollowedUp(a: TrackedApplication) {
    void patch(a.id, { followUpAt: defaultFollowUpAt(new Date()).toISOString() });
  }

  async function add(form: HTMLFormElement): Promise<boolean> {
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const company = String(data.get("company") ?? "").trim();
    const url = String(data.get("url") ?? "").trim();
    const status = String(data.get("status") ?? "applied") as ApplicationStatus;
    const body: CreateApplicationRequest = {
      posting: {
        title,
        company,
        descriptionText: "",
        sourceUrl: url || PASTED_TEXT_URL,
        source: url ? "generic" : "pasted_text",
        parsedBy: "manual",
      },
      status,
    };
    const res = await fetch(API_ROUTES.applications, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't add that application. Check the fields and try again.");
      return false;
    }
    const { application } = ApplicationResponseSchema.parse(await res.json());
    setApps((list) => [application, ...list.filter((a) => a.id !== application.id)]);
    return true;
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active" value={String(active)} hint={`${apps.length} tracked in total`} />
        <Stat label="Follow-ups due" value={String(due)} hint="Applied or interviewing" />
        <Stat label="Applied this week" value={String(appliedThisWeek)} />
        <Stat
          label="Average freshness"
          value={avg === null ? "—" : String(avg)}
          hint="Score when you saved"
        />
      </div>

      {due > 0 && (
        <p className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-medium-tint px-4 py-3 text-sm text-medium">
          <span>
            {due} application{due === 1 ? " is" : "s are"} due for a follow-up.
          </span>
          {filter !== "due" && (
            <button
              type="button"
              onClick={() => setFilter("due")}
              className="font-semibold underline-offset-2 hover:underline"
            >
              Show them
            </button>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-low-tint px-4 py-3 text-sm text-low">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter applications" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                filter === f.id
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-line bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="app-search">
            Search applications
          </label>
          <input
            id="app-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search role or company   /"
            className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-muted sm:w-60"
          />
          <label className="sr-only" htmlFor="app-sort">
            Sort by
          </label>
          <select
            id="app-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {Object.entries(SORTS).map(([id, label]) => (
              <option key={id} value={id}>
                Sort: {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper"
          >
            + Add manually
          </button>
        </div>
      </div>

      {apps.length === 0 ? (
        <div
          data-testid={TEST_IDS.web.dashboardEmpty}
          className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center"
        >
          <p className="text-lg font-medium">Track your first application</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Use &ldquo;Save &amp; track&rdquo; in the Chrome extension or on the check page, or add
            a role you found somewhere else.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/extension"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-strong"
            >
              Get the extension
            </Link>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
            >
              Add manually
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          No applications match these filters.{" "}
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
            className="font-medium text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="relative mt-4 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[820px] text-left text-sm">
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
              {visible.map((a) => {
                const isDue = isFollowUpDue(a, now);
                return (
                  <tr
                    key={a.id}
                    data-testid={dashboardRowTestId(a.id)}
                    className="transition-colors hover:bg-paper/60"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setOpenId(a.id)}
                        className="text-left font-medium hover:text-brand hover:underline"
                      >
                        {a.title}
                      </button>
                      <p className="text-muted">
                        {a.company}
                        {a.notes && (
                          <span className="ml-2 text-xs" title="Has notes">
                            · notes
                          </span>
                        )}
                      </p>
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
                        onChange={(e) =>
                          void patch(a.id, { status: e.target.value as ApplicationStatus })
                        }
                        data-testid={TEST_IDS.web.dashboardStatusSelect}
                        className={`rounded-md border-2 bg-surface px-2 py-1 ${STATUS_TONES[a.status]}`}
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
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            data-testid={TEST_IDS.web.dashboardFollowUpDue}
                            className="rounded-md bg-medium-tint px-2 py-0.5 font-medium text-medium"
                          >
                            Due {fmt(a.followUpAt)}
                          </span>
                          <button
                            type="button"
                            onClick={() => markFollowedUp(a)}
                            className="text-xs font-medium text-brand hover:underline"
                          >
                            Mark followed up<span className="sr-only"> for {a.title}</span>
                          </button>
                        </span>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`follow-${a.id}`}>
                            Follow-up date for {a.title}
                          </label>
                          <input
                            id={`follow-${a.id}`}
                            type="date"
                            value={toDateInput(a.followUpAt)}
                            onChange={(e) =>
                              void patch(a.id, { followUpAt: fromDateInput(e.target.value) })
                            }
                            className="rounded-md border border-line bg-surface px-2 py-1"
                          />
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenId(a.id)}
                        className="rounded-md px-2 py-1 text-ink-soft hover:bg-paper hover:text-ink"
                      >
                        Details<span className="sr-only"> for {a.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(a)}
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
      )}

      {open && (
        <DetailsDrawer
          key={open.id}
          app={open}
          onClose={() => setOpenId(null)}
          onPatch={(body) => patch(open.id, body)}
          onRemove={() => remove(open)}
          onFollowedUp={() => markFollowedUp(open)}
        />
      )}
      {adding && <AddDialog onClose={() => setAdding(false)} onAdd={add} />}

      {pending && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-rise items-center justify-between gap-4 rounded-xl bg-ink px-4 py-3 text-sm text-paper shadow-card"
        >
          <span className="truncate">Removed {pending.app.title}</span>
          <button
            type="button"
            onClick={undo}
            className="shrink-0 rounded-md px-2 py-1 font-semibold underline-offset-2 hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

/** A native <dialog>: focus trap, Escape to close and inert background for free. */
function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handle = () => close.current();
    dialog.addEventListener("close", handle);
    return () => dialog.removeEventListener("close", handle);
  }, []);
  return ref;
}

function DetailsDrawer({
  app,
  onClose,
  onPatch,
  onRemove,
  onFollowedUp,
}: {
  app: TrackedApplication;
  onClose: () => void;
  onPatch: (body: UpdateApplicationRequest) => Promise<boolean>;
  onRemove: () => void;
  onFollowedUp: () => void;
}) {
  const ref = useModal(onClose);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [saved, setSaved] = useState(false);
  const dirty = notes !== (app.notes ?? "");
  const hasLink = /^https?:/.test(app.sourceUrl);

  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      className="m-0 ml-auto h-full max-h-none w-full max-w-md bg-surface p-0 text-ink shadow-card backdrop:bg-ink/30"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-lg font-semibold">
              {app.title}
            </h2>
            <p className="text-muted">{app.company}</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close details"
            className="rounded-md p-1.5 text-ink-soft hover:bg-paper"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          <div className="flex items-center gap-3">
            <ScorePill score={app.scoreAtSave} />
            <span className="text-muted">Freshness when you saved it</span>
          </div>
          {hasLink && (
            <a
              href={app.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-medium text-brand hover:underline"
            >
              Open the posting ↗
            </a>
          )}
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted">Saved</dt>
              <dd className="font-medium">{fmt(app.savedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="font-medium">{STATUS_LABELS[app.status]}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="drawer-applied" className="text-muted">
                Applied on
              </label>
              <input
                id="drawer-applied"
                type="date"
                value={toDateInput(app.appliedAt)}
                onChange={(e) => void onPatch({ appliedAt: fromDateInput(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="drawer-follow" className="text-muted">
                Follow up on
              </label>
              <input
                id="drawer-follow"
                type="date"
                value={toDateInput(app.followUpAt)}
                onChange={(e) => void onPatch({ followUpAt: fromDateInput(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
          {app.followUpAt && (
            <button
              type="button"
              onClick={onFollowedUp}
              className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-paper"
            >
              I followed up · remind me in a week
            </button>
          )}
          <div>
            <label htmlFor="drawer-notes" className="font-medium">
              Notes
            </label>
            <textarea
              id="drawer-notes"
              rows={6}
              maxLength={5000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              placeholder="Recruiter name, interview dates, what you sent…"
              className={inputClass}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={!dirty}
                onClick={async () => {
                  if (await onPatch({ notes: notes.trim() ? notes : null })) setSaved(true);
                }}
                className="rounded-lg bg-brand px-3 py-1.5 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-50"
              >
                Save notes
              </button>
              {saved && !dirty && (
                <span role="status" className="text-muted">
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-line p-5">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-low hover:bg-low-tint"
          >
            Remove from dashboard
          </button>
        </div>
      </div>
    </dialog>
  );
}

function AddDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (form: HTMLFormElement) => Promise<boolean>;
}) {
  const ref = useModal(onClose);
  const [busy, setBusy] = useState(false);
  return (
    <dialog
      ref={ref}
      aria-labelledby="add-title"
      className="m-auto w-full max-w-md rounded-2xl bg-surface p-0 text-ink shadow-card backdrop:bg-ink/30"
    >
      <form
        className="space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await onAdd(e.currentTarget);
          setBusy(false);
          if (ok) ref.current?.close();
        }}
      >
        <h2 id="add-title" className="text-lg font-semibold">
          Add an application
        </h2>
        <p className="text-sm text-muted">
          For roles you found somewhere Real Role can&apos;t read, like a referral or a career fair.
        </p>
        <div>
          <label htmlFor="add-role" className="text-sm font-medium">
            Job title
          </label>
          <input id="add-role" name="title" required maxLength={300} className={inputClass} />
        </div>
        <div>
          <label htmlFor="add-company" className="text-sm font-medium">
            Company
          </label>
          <input id="add-company" name="company" required maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor="add-url" className="text-sm font-medium">
            Link <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="add-url" name="url" type="url" placeholder="https://" className={inputClass} />
        </div>
        <div>
          <label htmlFor="add-status" className="text-sm font-medium">
            Status
          </label>
          <select id="add-status" name="status" defaultValue="applied" className={inputClass}>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add application"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
