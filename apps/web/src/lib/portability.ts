import { z } from "zod";
import {
  ApplicationStatusSchema,
  IsoDateTimeSchema,
  type TrackedApplication,
} from "@real-role/shared";
import { JobFactsSchema, type JobFacts } from "./job-preferences";

export const CSV_COLUMNS = [
  "title",
  "company",
  "url",
  "status",
  "appliedAt",
  "followUpAt",
  "notes",
  "location",
  "remote",
  "employmentType",
  "salaryMin",
  "salaryMax",
  "currency",
  "payPeriod",
  "experienceMinYears",
] as const;
export const ImportRowSchema = z.object({
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().min(1).max(200),
  url: z
    .string()
    .max(2048)
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
      } catch {
        return false;
      }
    }),
  status: ApplicationStatusSchema,
  appliedAt: IsoDateTimeSchema.optional(),
  followUpAt: IsoDateTimeSchema.optional(),
  notes: z.string().max(5000).optional(),
  facts: JobFactsSchema,
});
export type ImportRow = z.infer<typeof ImportRowSchema>;
const formula = /^[\s]*[=+@-]/;
const quote = (value: string) =>
  `"${(formula.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
const unprotect = (v: string) => (v.startsWith("'") && formula.test(v.slice(1)) ? v.slice(1) : v);
export function exportApplicationsCsv(
  apps: TrackedApplication[],
  facts: Record<string, JobFacts> = {},
) {
  return (
    "\ufeff" +
    [
      CSV_COLUMNS.join(","),
      ...apps.map((a) => {
        const f = facts[a.id] ?? {};
        return [
          a.title,
          a.company,
          /^https?:\/\//.test(a.sourceUrl) ? a.sourceUrl : "",
          a.status,
          a.appliedAt ?? "",
          a.followUpAt ?? "",
          a.notes ?? "",
          f.location ?? "",
          f.remote === undefined ? "" : String(f.remote),
          f.employmentType ?? "",
          f.salary?.min?.toString() ?? "",
          f.salary?.max?.toString() ?? "",
          f.salary?.currency ?? "",
          f.salary?.period ?? "",
          f.experienceMinYears?.toString() ?? "",
        ]
          .map(quote)
          .join(",");
      }),
    ].join("\r\n") +
    "\r\n"
  );
}

export function parseApplicationsCsv(text: string): ImportRow[] {
  if (new TextEncoder().encode(text).length > 100000)
    throw new Error("Use a CSV file smaller than 100 kB.");
  const source = text.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  function endCell() {
    row.push(unprotect(cell));
    cell = "";
    closed = false;
    if (row.length > CSV_COLUMNS.length) throw new Error("Too many columns.");
  }
  function endRow() {
    endCell();
    if (row.some((v) => v !== "")) rows.push(row);
    row = [];
    if (rows.length > 51) throw new Error("Import at most 50 rows at a time.");
  }
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === ",") endCell();
    else if (c === "\r" || c === "\n") {
      endRow();
      if (c === "\r" && source[i + 1] === "\n") i++;
    } else if (c === '"') {
      if (cell || closed) throw new Error("Invalid CSV quoting.");
      quoted = true;
    } else {
      if (closed) throw new Error("Unexpected text after a quoted field.");
      cell += c;
    }
    if (cell.length > 6000) throw new Error("A CSV field is too long.");
  }
  if (quoted) throw new Error("A quoted field was not closed.");
  if (cell || row.length || closed) endRow();
  const header = rows.shift();
  if (!header || header.join(",") !== CSV_COLUMNS.join(","))
    throw new Error("Use the exact columns from the downloadable template, in the same order.");
  if (!rows.length) throw new Error("The CSV has no application rows.");
  return rows.map((cells, index) => {
    if (cells.length !== header.length)
      throw new Error(`Row ${index + 2}: incorrect number of columns.`);
    const v = Object.fromEntries(header.map((key, i) => [key, cells[i]!]));
    const number = (key: string) => (v[key] === "" ? undefined : Number(v[key]));
    const salary = [v.salaryMin, v.salaryMax, v.currency, v.payPeriod].some(Boolean)
      ? {
          min: number("salaryMin"),
          max: number("salaryMax"),
          currency: v.currency || undefined,
          period: v.payPeriod || undefined,
        }
      : undefined;
    const result = ImportRowSchema.safeParse({
      title: v.title,
      company: v.company,
      url: v.url,
      status: v.status || "saved",
      appliedAt: v.appliedAt || undefined,
      followUpAt: v.followUpAt || undefined,
      notes: v.notes || undefined,
      facts: {
        location: v.location || undefined,
        remote:
          v.remote === ""
            ? undefined
            : v.remote === "true"
              ? true
              : v.remote === "false"
                ? false
                : v.remote,
        employmentType: v.employmentType || undefined,
        salary,
        experienceMinYears: number("experienceMinYears"),
      },
    });
    if (!result.success)
      throw new Error(
        `Row ${index + 2}: invalid ${result.error.issues[0]?.path.join(".") ?? "data"}. Check the template instructions.`,
      );
    return result.data;
  });
}

export function importIdentity(row: Pick<ImportRow, "url" | "title" | "company">): string {
  if (row.url) {
    const url = new URL(row.url);
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  }
  return `text:${row.title.trim().toLowerCase()}|${row.company.trim().toLowerCase()}`;
}
export function previewImport(rows: ImportRow[], existing: TrackedApplication[]) {
  const seen = new Set(
    existing.map((a) =>
      importIdentity({
        title: a.title,
        company: a.company,
        url: /^https?:\/\//.test(a.sourceUrl) ? a.sourceUrl : "",
      }),
    ),
  );
  return rows.map((row) => {
    const key = importIdentity(row),
      duplicate = seen.has(key);
    seen.add(key);
    return { row, duplicate };
  });
}
