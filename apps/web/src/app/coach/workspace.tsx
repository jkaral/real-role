"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  CoachItemSchema,
  InviteTokenSchema,
  InvitePreviewSchema,
  type CoachItem,
} from "@/lib/coach-contract";
const KEY = "rr-pending-coach-invite";
export function CoachWorkspace({ signedIn, initial }: { signedIn: boolean; initial: CoachItem[] }) {
  const [items, setItems] = useState(initial),
    [token, setToken] = useState(""),
    [preview, setPreview] = useState<z.infer<typeof InvitePreviewSchema> | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const fragment = new URLSearchParams(location.hash.slice(1)).get("invite");
      const saved = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      const candidate = fragment ?? saved;
      if (candidate && InviteTokenSchema.safeParse(candidate).success) setToken(candidate);
      if (fragment) history.replaceState(null, "", "/coach");
    } catch {
      /* Invitation entry still works when browser storage is blocked. */
    }
  }, []);
  async function refresh() {
    const r = await fetch("/api/coach-shares", { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error();
    setItems(z.object({ items: z.array(CoachItemSchema) }).parse(await r.json()).items);
  }
  async function invitation(action: "preview" | "accept") {
    if (!InviteTokenSchema.safeParse(token).success) {
      setMessage("Paste a valid invitation link or code.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/coach-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error();
      if (action === "preview") setPreview(InvitePreviewSchema.parse(await r.json()));
      else {
        setPreview(null);
        setToken("");
        await refresh();
        setMessage("Invitation accepted. The opening is now visible below.");
      }
    } catch {
      setMessage(
        "This invitation is unavailable, expired, already accepted, or belongs to your own application. Refresh shared openings if you already accepted it.",
      );
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  function input(value: string) {
    let next = value.trim();
    try {
      const url = new URL(next);
      next = new URLSearchParams(url.hash.slice(1)).get("invite") ?? next;
    } catch {
      /* A raw invitation code is valid input too. */
    }
    setToken(next);
    setPreview(null);
    setMessage("");
  }
  return (
    <>
      {!signedIn && (
        <p className="mt-5 rounded border border-line p-4">
          <Link
            className="text-brand underline"
            href="/signin?callbackUrl=/coach"
            onClick={() => {
              try {
                if (InviteTokenSchema.safeParse(token).success) sessionStorage.setItem(KEY, token);
              } catch {
                /* Reopen the invitation link after sign-in if storage is unavailable. */
              }
            }}
          >
            Sign in to accept an invitation
          </Link>
          . If sign-in opens another tab, reopen the original invitation link afterwards.
        </p>
      )}
      <section
        aria-label="Accept coach invitation"
        className="mt-6 rounded-xl border border-line bg-surface p-5"
      >
        <h2 className="text-xl font-semibold">Review an invitation</h2>
        <label htmlFor="coach-invite-code" className="mt-3 block text-sm">
          Invitation link or code
        </label>
        <input
          id="coach-invite-code"
          type="text"
          autoComplete="off"
          value={token}
          disabled={busy}
          onChange={(e) => input(e.target.value)}
          className="mt-1 w-full rounded border border-line bg-surface p-2"
        />
        <button
          type="button"
          disabled={busy || !signedIn}
          className="mt-3 rounded border border-line px-3 py-2 disabled:opacity-50"
          onClick={() => void invitation("preview")}
        >
          Review invitation
        </button>
        {preview && (
          <div className="mt-4 rounded border border-line p-4">
            <p className="font-semibold">
              {preview.title} · {preview.company}
            </p>
            <p>
              Shared by {preview.ownerName ?? "the application owner"}. Invitation expires{" "}
              {new Date(preview.expiresAt).toLocaleDateString()}.
            </p>
            <p className="mt-2 text-sm text-muted">
              Accepting binds this single-use invitation to your signed-in account. You receive
              read-only access to this opening’s listed details. The owner sees your display name
              and can revoke access. Do not forward the invitation.
            </p>
            <button
              type="button"
              disabled={busy}
              className="mt-3 rounded bg-brand px-4 py-2 text-on-brand"
              onClick={() => void invitation("accept")}
            >
              Accept read-only invitation
            </button>
          </div>
        )}
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      </section>
      {signedIn && (
        <section className="mt-8" aria-label="Shared openings">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Shared openings ({items.length})</h2>
            <button
              type="button"
              disabled={busy}
              className="rounded border border-line px-3 py-2"
              onClick={async () => {
                setBusy(true);
                try {
                  await refresh();
                  setMessage("Shared openings refreshed.");
                } catch {
                  setMessage("Could not refresh shared openings.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Refresh shared openings
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            Access is rechecked on refresh. Owners can revoke access, but information already copied
            cannot be erased remotely.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-line bg-surface p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p>
                  {item.company} · shared by {item.ownerName ?? "owner"}
                </p>
                <p>Status: {item.status.replaceAll("_", " ")}</p>
                <p>
                  Freshness at save:{" "}
                  {item.scoreAtSave === null ? "Unknown" : `${item.scoreAtSave}/100`} ·{" "}
                  {item.confidenceAtSave ?? "unknown"} confidence
                </p>
                <p>Location: {item.facts.location ?? "Unknown"}</p>
                <p>
                  Workplace:{" "}
                  {item.facts.remote === undefined
                    ? "Unknown"
                    : item.facts.remote
                      ? "Remote"
                      : "Not fully remote"}
                </p>
                <p>Employment type: {item.facts.employmentType ?? "Unknown"}</p>
                <p>
                  Disclosed pay:{" "}
                  {item.facts.salary
                    ? `${item.facts.salary.min ?? "?"}–${item.facts.salary.max ?? "?"} ${item.facts.salary.currency ?? "currency unknown"}/${item.facts.salary.period ?? "period unknown"}`
                    : "Unknown"}
                </p>
                <p>
                  Minimum experience:{" "}
                  {item.facts.experienceMinYears === undefined
                    ? "Unknown"
                    : `${item.facts.experienceMinYears} years`}
                </p>
                {/^https?:\/\//.test(item.sourceUrl) && (
                  <a
                    className="mt-3 inline-block text-brand underline"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open shared posting
                  </a>
                )}
              </li>
            ))}
          </ul>
          {!items.length && (
            <p className="mt-4">No accepted, active shares. Review an invitation above to begin.</p>
          )}
        </section>
      )}
      <p className="mt-6">
        <Link href="/dashboard" className="text-brand underline">
          Your own applications
        </Link>
      </p>
    </>
  );
}
