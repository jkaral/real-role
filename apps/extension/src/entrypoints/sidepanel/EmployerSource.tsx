import { useState } from "react";
import type { ParsedPosting } from "@real-role/shared";
import {
  EMPLOYER_SOURCE_ROUTE,
  EmployerSourceResponseSchema,
  type EmployerSourceResponse,
} from "@real-role/ats";
import { API_BASE } from "@/lib/config";

export function EmployerSource({ posting }: { posting: ParsedPosting }) {
  const [boardUrl, setBoardUrl] = useState("");
  const [data, setData] = useState<EmployerSourceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setError("");
    setData(null);
    try {
      const response = await fetch(`${API_BASE}${EMPLOYER_SOURCE_ROUTE}`, {
        method: "POST",
        credentials: "include",
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
      setData(EmployerSourceResponseSchema.parse(await response.json()));
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "The source check timed out. Please try again."
          : "Could not read this source. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack" aria-label="Employer source">
      <h2>Check the employer’s source</h2>
      <p className="muted small">Check an official public board once. No background monitoring.</p>
      <label htmlFor="employer-board">Employer’s board URL (optional for hosted postings)</label>
      <input
        id="employer-board"
        type="url"
        placeholder="https://jobs.lever.co/employer"
        value={boardUrl}
        disabled={busy}
        onChange={(e) => {
          setBoardUrl(e.target.value);
          setData(null);
        }}
      />
      <button type="button" className="secondary" disabled={busy} onClick={() => void check()}>
        {busy ? "Checking source…" : "Find employer listing"}
      </button>
      <div role="status" aria-busy={busy}>
        {error && <p>{error}</p>}
        {data && (
          <>
            {data.status === "needs_board" && (
              <p>Add a hosted Greenhouse, Lever or Ashby board link.</p>
            )}
            {data.status === "unsupported" && (
              <p>This link is not a supported Greenhouse, Lever or Ashby board.</p>
            )}
            {data.status === "unavailable" && (
              <p>The board could not be checked. This does not mean the role is closed.</p>
            )}
            {data.status === "no_match" && (
              <p>
                No matching title and location were found. The role may be listed elsewhere or under
                another name.
              </p>
            )}
            {data.listing && (
              <>
                <a href={data.listing.url} target="_blank" rel="noopener noreferrer">
                  {data.listing.exactListing
                    ? "Open this listing"
                    : "Open possible matching listing"}
                </a>
                <p>
                  {data.listing.title}
                  {data.listing.location && ` · ${data.listing.location}`}
                </p>
                <p className="muted small">
                  {data.listing.reason} Confirm the employer before applying.
                </p>
              </>
            )}
            {data.boardUrl && (
              <p>
                <a href={data.boardUrl} target="_blank" rel="noopener noreferrer">
                  View checked board
                </a>
              </p>
            )}
            <p className="muted small">
              Checked {new Date(data.checkedAt).toLocaleString()}. Publication does not guarantee
              active hiring.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
