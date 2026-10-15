import { z } from "zod";
import {
  ParsedPostingSchema,
  SalarySchema,
  type ParseGeneric,
  type ParsePosting,
  type PostingParser,
  type ParsedPosting,
} from "@real-role/shared";

const object = z.record(z.string(), z.unknown());
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const record = (value: unknown): Record<string, unknown> => object.safeParse(value).data ?? {};
const select = (doc: Document, selector: string): string | undefined =>
  text(doc.querySelector(selector)?.textContent);

function salaryFromText(input: string) {
  const range = input.match(/\b(CAD|USD|EUR|GBP)\s*\$?\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/i);
  if (!range) return undefined;
  const min = Number(range[2]!.replaceAll(",", ""));
  const max = Number(range[3]!.replaceAll(",", ""));
  if (min > max) return undefined;
  return { min, max, currency: range[1]!.toUpperCase() };
}

function plain(doc: Document, html: string): string {
  const template = doc.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
  template.content
    .querySelectorAll("p,div,li,br,h1,h2,h3")
    .forEach((node) => node.append(doc.createTextNode("\n")));
  return (template.content.textContent ?? "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim()
    .slice(0, 50000);
}

function iso(value: unknown): string | undefined {
  const input = text(value);
  if (!input || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(input)) return undefined;
  // Date-only metadata is UTC midnight; timestamps without offsets are ambiguous.
  if (input.length !== 10 && !/(Z|[+-]\d{2}:\d{2})$/.test(input)) return undefined;
  return Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : undefined;
}

function jobs(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 12) return [];
  if (Array.isArray(value)) return value.flatMap((item) => jobs(item, depth + 1));
  const obj = record(value);
  const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
  if (types.includes("JobPosting")) return [obj];
  return jobs(obj["@graph"], depth + 1);
}

function fromJson(doc: Document, data: Record<string, unknown>, url: string): ParsedPosting | null {
  const employer = record(data.hiringOrganization);
  const locations = (Array.isArray(data.jobLocation) ? data.jobLocation : [data.jobLocation])
    .map((item) => {
      const location = record(item);
      const address = record(location.address);
      return (
        text(location.name) ??
        (typeof location.address === "string"
          ? location.address
          : [address.addressLocality, address.addressRegion, address.addressCountry]
              .map(text)
              .filter(Boolean)
              .join(", "))
      );
    })
    .filter(Boolean)
    .join("; ");
  const baseSalary = record(data.baseSalary);
  const value = record(baseSalary.value);
  const number = (input: unknown): number | undefined =>
    typeof input === "number" && Number.isFinite(input) && input >= 0 ? input : undefined;
  const salary = SalarySchema.safeParse({
    min:
      number(value.minValue) ??
      number(typeof baseSalary.value === "number" ? baseSalary.value : value.value),
    max: number(value.maxValue),
    currency: text(baseSalary.currency),
    period: text(value.unitText)?.toLowerCase(),
  });
  let companyDomain: string | undefined;
  try {
    const companyUrl = new URL(text(employer.sameAs) ?? text(employer.url) ?? "");
    if (["http:", "https:"].includes(companyUrl.protocol)) companyDomain = companyUrl.hostname;
  } catch {
    /* Missing company domain lowers available evidence. */
  }
  const identifier = record(data.identifier);
  const posting = ParsedPostingSchema.safeParse({
    title: text(data.title),
    company: text(employer.name) ?? text(data.hiringOrganization),
    companyDomain,
    location: locations || undefined,
    remote: data.jobLocationType === "TELECOMMUTE" ? true : undefined,
    employmentType: Array.isArray(data.employmentType)
      ? data.employmentType.map(text).filter(Boolean).join(", ")
      : text(data.employmentType),
    descriptionText: plain(doc, text(data.description) ?? ""),
    postedAt: iso(data.datePosted),
    validThrough: iso(data.validThrough),
    salary:
      salary.success && Object.values(salary.data).some((item) => item !== undefined)
        ? salary.data
        : salaryFromText(plain(doc, text(data.description) ?? "")),
    externalId: text(identifier.value) ?? text(data.identifier),
    sourceUrl: url,
    source: "generic",
    parsedBy: "generic-jsonld",
  });
  return posting.success ? posting.data : null;
}

export const parseGeneric: ParseGeneric = (doc, url = doc.URL) => {
  const candidates: Record<string, unknown>[] = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    if ((script.textContent?.length ?? 0) > 1_000_000) continue;
    try {
      candidates.push(...jobs(JSON.parse(script.textContent ?? "")));
    } catch {
      /* Try other independent metadata blocks. */
    }
  }
  // Never pick an arbitrary job from a listing page containing multiple postings.
  const parsed = candidates
    .map((data) => fromJson(doc, data, url))
    .filter((item): item is ParsedPosting => item !== null);
  if (parsed.length === 1) return parsed[0]!;
  if (parsed.length > 1) return null;
  const scope = doc.querySelector(
    '[itemtype="https://schema.org/JobPosting"], [itemtype="http://schema.org/JobPosting"]',
  );
  if (!scope) return null;
  const field = (name: string) =>
    text(scope.querySelector(`[itemprop="${name}"]`)?.getAttribute("content")) ??
    text(scope.querySelector(`[itemprop="${name}"]`)?.textContent);
  const result = ParsedPostingSchema.safeParse({
    title: field("title"),
    company:
      text(scope.querySelector('[itemprop="hiringOrganization"] [itemprop="name"]')?.textContent) ??
      field("hiringOrganization"),
    location: field("jobLocation"),
    descriptionText: plain(doc, scope.querySelector('[itemprop="description"]')?.innerHTML ?? ""),
    postedAt: iso(field("datePosted")),
    sourceUrl: url,
    source: "generic",
    parsedBy: "generic-microdata",
  });
  return result.success ? result.data : null;
};

const definitions = [
  {
    id: "greenhouse",
    hosts: ["boards.greenhouse.io", "job-boards.greenhouse.io"],
    title: ".app-title, .job__title, h1",
    company: ".company-name, .job__company, [data-company]",
    location: ".location, .job__location",
    description: "#content, .job__description",
    path: /\/(?:jobs\/)?([^/]+)\/?$/,
  },
  {
    id: "lever",
    hosts: ["jobs.lever.co", "jobs.eu.lever.co"],
    title: ".posting-headline h2",
    company: ".main-header-logo img[alt], .company-name",
    location: ".posting-categories .location",
    description: ".posting-page .content, .content",
    path: /\/([^/]+)\/?$/,
  },
  {
    id: "ashby",
    hosts: ["jobs.ashbyhq.com"],
    title: "h1",
    company: ".ashby-job-posting-company-name, [data-company]",
    location: ".ashby-job-posting-location",
    description: ".ashby-job-posting-description",
    path: /\/([^/]+)\/?$/,
  },
] as const;

export const parsers: readonly PostingParser[] = definitions.map((definition) => ({
  id: definition.id,
  source: definition.id,
  canParse(url) {
    try {
      return (definition.hosts as readonly string[]).includes(new URL(url).hostname);
    } catch {
      return false;
    }
  },
  parse(doc, url = doc.URL) {
    const structured = parseGeneric(doc, url);
    if (structured) return { ...structured, source: definition.id, parsedBy: definition.id };
    const title = select(doc, definition.title);
    const companyNode = doc.querySelector(definition.company);
    const company =
      text(companyNode?.getAttribute("alt")) ??
      text(companyNode?.getAttribute("data-company")) ??
      text(companyNode?.textContent);
    const description = doc.querySelector(definition.description);
    if (!title || !company || !description) return null;
    const path = new URL(url).pathname;
    if (path.split("/").filter(Boolean).length < 2 || /\/apply\/?$/.test(path)) return null;
    const descriptionText = plain(doc, description.innerHTML);
    const result = ParsedPostingSchema.safeParse({
      title,
      company,
      descriptionText,
      salary: salaryFromText(descriptionText),
      location: select(doc, definition.location),
      sourceUrl: url,
      source: definition.id,
      parsedBy: definition.id,
      externalId: path.match(definition.path)?.[1],
      postedAt: iso(doc.querySelector("time[datetime]")?.getAttribute("datetime")),
    });
    return result.success ? result.data : null;
  },
}));

export const parsePosting: ParsePosting = (doc, url = doc.URL) => {
  for (const parser of parsers) {
    try {
      if (parser.canParse(url, doc)) {
        const posting = parser.parse(doc, url);
        if (posting) return posting;
      }
    } catch {
      /* A malformed page must not break the content script. */
    }
  }
  return parseGeneric(doc, url);
};
