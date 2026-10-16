"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ManagedShareSchema, InviteTokenSchema } from "@/lib/coach-contract";
type Share = z.infer<typeof ManagedShareSchema>;
export function CoachSharing({ applicationId }: { applicationId: string }) {
  const [shares, setShares] = useState<Share[]>([]),
    [link, setLink] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch(`/api/coach-shares?applicationId=${encodeURIComponent(applicationId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error();
    setShares(z.object({ shares: z.array(ManagedShareSchema) }).parse(await r.json()).shares);
  }
  useEffect(() => {
    void refresh().catch(() =>
      setMessage("Could not load shares. Close and reopen these details to retry."),
    );
  }, [applicationId]);
  async function action(
    input: { action: "create"; applicationId: string } | { action: "revoke"; shareId: string },
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/coach-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error();
      if (input.action === "create") {
        const data = z.object({ token: InviteTokenSchema }).parse(await r.json());
        setLink(`${location.origin}/coach#invite=${encodeURIComponent(data.token)}`);
        setMessage(
          "Invitation created. Copy it only to the intended coach. It expires in seven days.",
        );
      } else {
        setLink("");
        setMessage("Share revoked. Access ends on the recipient’s next request.");
      }
      await refresh();
    } catch {
      setMessage("Could not update sharing. Check existing invitations or try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Coach sharing" className="space-y-3 border-t border-line pt-4">
      <h3 className="font-semibold">Share with a coach (read only)</h3>
      <p className="text-muted">
        Share only this opening’s title, company, link, status, saved freshness and disclosed job
        facts. Your display name is visible. Private notes, preferences and other applications stay
        private. Anyone holding a pending link can accept it, so send it only to the intended
        recipient.
      </p>
      <button
        type="button"
        disabled={busy}
        className="rounded border border-line px-3 py-2"
        onClick={() => void action({ action: "create", applicationId })}
      >
        Create single-use invitation
      </button>
      {link && (
        <>
          <label htmlFor="coach-invite-link" className="block">
            Invitation link
          </label>
          <input
            id="coach-invite-link"
            readOnly
            value={link}
            className="w-full rounded border border-field bg-surface p-2"
          />
          <button
            type="button"
            className="underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Invitation link copied.");
              } catch {
                setMessage("Select the invitation link to copy it manually.");
              }
            }}
          >
            Copy invitation link
          </button>
        </>
      )}
      <ul className="space-y-2">
        {shares.map((s) => (
          <li key={s.id} className="rounded border border-line p-2">
            {s.revokedAt
              ? "Revoked"
              : s.acceptedAt
                ? `Accepted by ${s.recipientName ?? "recipient"}`
                : Date.parse(s.expiresAt) < Date.now()
                  ? "Expired"
                  : "Pending acceptance"}
            {!s.revokedAt && (
              <button
                type="button"
                disabled={busy}
                className="ml-3 underline"
                onClick={() => void action({ action: "revoke", shareId: s.id })}
              >
                Revoke share
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-muted">Revocation cannot erase information a coach already copied.</p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
