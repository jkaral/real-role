"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ListApplicationsResponseSchema, type TrackedApplication } from "@real-role/shared";
import { JobFactsSchema } from "@/lib/job-preferences";
import {
  CSV_COLUMNS,
  exportApplicationsCsv,
  parseApplicationsCsv,
  previewImport,
  type ImportRow,
} from "@/lib/portability";

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Portability({
  applications,
  onImported,
}: {
  applications: TrackedApplication[];
  onImported: () => void;
}) {
  const router = useRouter(),
    [rows, setRows] = useState<ImportRow[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const preview = previewImport(rows, applications),
    count = preview.filter((p) => !p.duplicate).length;
  async function exportCsv() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/shortlist", { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const apps = ListApplicationsResponseSchema.parse(data).applications;
      const facts = z.record(z.string(), JobFactsSchema).parse(data.facts);
      download(exportApplicationsCsv(apps, facts), "real-role-applications.csv");
      setMessage(
        "Export downloaded. Keep it private: it contains your application notes and saved job facts.",
      );
    } catch {
      setMessage("Could not export. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/applications/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error();
      const result = z
        .object({
          imported: z.number().int().nonnegative(),
          duplicates: z.number().int().nonnegative(),
        })
        .parse(await res.json());
      setMessage(
        `Imported ${result.imported}; skipped ${result.duplicates} duplicates. Existing statuses and notes were kept.`,
      );
      setRows([]);
      onImported();
      router.refresh();
    } catch {
      setMessage(
        "Import did not finish. Some rows may already be saved. Refresh and preview again; duplicates will be skipped.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-6 rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer font-medium">Import or export applications</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>
          Export all tracked applications and saved facts. Import at most 50 rows and 100 kB per
          file; preview before confirming. Existing records are never overwritten. Imported scores
          and prior status history are not reconstructed.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            className="rounded border border-line px-3 py-2"
            onClick={() => void exportCsv()}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded border border-line px-3 py-2"
            onClick={() =>
              download(CSV_COLUMNS.join(",") + "\r\n", "real-role-import-template.csv")
            }
          >
            Download CSV template
          </button>
        </div>
        <p className="text-muted">
          Use ISO dates with an offset (for example 2026-10-15T09:00:00-04:00); remote is true/false
          or empty; pay period is hour/day/week/month/year. Leave unknown fields blank. Spreadsheet
          formulas are exported as plain text.
        </p>
        <label className="block">
          Choose CSV to preview
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="mt-2 block w-full"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setRows([]);
              setMessage("");
              if (!file) return;
              if (file.size > 100000) {
                setMessage("Use a file smaller than 100 kB.");
                return;
              }
              try {
                setRows(parseApplicationsCsv(await file.text()));
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Could not read this CSV.");
              }
              e.target.value = "";
            }}
          />
        </label>
        {rows.length > 0 && (
          <>
            <h3 className="font-semibold">Import preview</h3>
            <p>
              {count} new rows; {rows.length - count} duplicate rows will be skipped. Review this
              list before confirming.
            </p>
            <ul className="max-h-64 overflow-y-auto space-y-2">
              {preview.map((p, i) => (
                <li key={i} className="rounded border border-line p-2">
                  {p.row.title} · {p.row.company} · {p.row.status} ·{" "}
                  {p.duplicate ? "Skip duplicate" : "New record"}
                  <details className="mt-2">
                    <summary className="cursor-pointer">Review all imported fields</summary>
                    <dl className="mt-2 space-y-1 break-words">
                      <div>
                        <dt className="font-medium">Posting link</dt>
                        <dd>{p.row.url || "Pasted/manual"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Applied / follow-up</dt>
                        <dd>
                          {p.row.appliedAt || "Not supplied"} /{" "}
                          {p.row.followUpAt ||
                            "Not supplied (defaults may apply when status is applied)"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium">Notes</dt>
                        <dd className="whitespace-pre-wrap">{p.row.notes || "None"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Saved job facts</dt>
                        <dd className="whitespace-pre-wrap">
                          Location: {p.row.facts.location ?? "Unknown"}
                          <br />
                          Workplace:{" "}
                          {p.row.facts.remote === undefined
                            ? "Unknown"
                            : p.row.facts.remote
                              ? "Remote"
                              : "Not fully remote"}
                          <br />
                          Employment type: {p.row.facts.employmentType ?? "Unknown"}
                          <br />
                          Pay:{" "}
                          {p.row.facts.salary
                            ? `${p.row.facts.salary.min ?? "?"}–${p.row.facts.salary.max ?? "?"} ${p.row.facts.salary.currency ?? "currency unknown"}/${p.row.facts.salary.period ?? "period unknown"}`
                            : "Unknown"}
                          <br />
                          Minimum experience:{" "}
                          {p.row.facts.experienceMinYears === undefined
                            ? "Unknown"
                            : `${p.row.facts.experienceMinYears} years`}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="rounded bg-brand px-4 py-2 text-on-brand disabled:opacity-50"
              disabled={busy || count === 0}
              onClick={() => void confirm()}
            >
              {busy ? "Importing…" : `Confirm import (${count} new)`}
            </button>
            <button
              type="button"
              disabled={busy}
              className="ml-3 underline"
              onClick={() => setRows([])}
            >
              Cancel preview
            </button>
          </>
        )}
        <p role="status">{message}</p>
      </div>
    </details>
  );
}
