"use client";

import { useRef, useState } from "react";
import type { ParsedPosting } from "@real-role/shared";
import {
  EMPLOYER_SOURCE_ROUTE,
  EmployerSourceResponseSchema,
  type EmployerSourceResponse,
} from "@real-role/ats";

const MESSAGES: Record<EmployerSourceResponse["status"], string> = {
  matched: "A matching listing was found. Check the employer and location before applying.",
  no_match:
    "No matching title and location were found on this board. The opening may be listed elsewhere or under another name.",
  unavailable: "This board could not be checked. That does not mean the opening is closed.",
  unsupported:
    "Use a hosted Greenhouse, Lever or Ashby board link. Other career sites are not supported here yet.",
  needs_board:
    "Add the employer’s hosted Greenhouse, Lever or Ashby board link to look for a matching listing.",
};

export function EmployerSource({ posting }: { posting: ParsedPosting }) {
  const [boardUrl, setBoardUrl] = useState("");
  const [data, setData] = useState<EmployerSourceResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  async function check() {
    const id = ++request.current;
    setBusy(true);
    setError("");
    setData(null);
    try {
      const response = await fetch(EMPLOYER_SOURCE_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting: { ...posting, descriptionText: "" },
          ...(boardUrl.trim() ? { boardUrl: boardUrl.trim() } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many checks. Wait a minute and try again."
            : "Could not check this source. Confirm the board link and try again.",
        );
        return;
      }
      const result = EmployerSourceResponseSchema.parse(await response.json());
      if (request.current === id) setData(result);
    } catch (e) {
      if (request.current === id)
        setError(
          e instanceof Error && e.name === "TimeoutError"
            ? "The source check timed out. Please try again."
            : "Could not read this source. Please try again.",
        );
    } finally {
      if (request.current === id) setBusy(false);
    }
  }
  return (
    <section aria-label="Employer source" className="mt-5 border-t border-line pt-5">
      <h3 className="font-semibold">Check the employer’s source</h3>
      <p className="mt-1 text-sm text-muted">
        Look for the role on an official public board. This checks once when you ask; it does not
        monitor the opening.
      </p>
      <label className="mt-3 block text-sm" htmlFor="employer-board">
        Employer’s board URL (optional for hosted postings)
      </label>
      <input
        id="employer-board"
        type="url"
        value={boardUrl}
        onChange={(e) => {
          setBoardUrl(e.target.value);
          setData(null);
        }}
        placeholder="https://jobs.lever.co/employer"
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2"
        disabled={busy}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void check()}
        className="mt-3 rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Checking source…" : "Find employer listing"}
      </button>
      <div role="status" aria-busy={busy} className="mt-3 text-sm">
        {error && <p>{error}</p>}
        {data && (
          <>
            <p>{MESSAGES[data.status]}</p>
            {data.listing && (
              <div className="mt-2">
                <a
                  className="font-medium text-brand underline"
                  href={data.listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.listing.exactListing
                    ? "Open this listing"
                    : "Open possible matching listing"}
                </a>
                <p>
                  {data.listing.title}
                  {data.listing.location && ` · ${data.listing.location}`}
                </p>
                <p className="text-muted">{data.listing.reason}</p>
              </div>
            )}
            {data.boardUrl && (
              <p className="mt-2">
                <a
                  className="text-brand underline"
                  href={data.boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View checked board
                </a>
              </p>
            )}
            <p className="mt-2 text-muted">
              Checked {new Date(data.checkedAt).toLocaleString()}. A listing is evidence of
              publication, not a guarantee of active hiring.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
