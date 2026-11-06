import { fingerprint, roleKey, ParsedPostingSchema, type ParsedPosting } from "@real-role/shared";

export const DAY = 86400000;
const fixturePort = Number(process.env.RR_E2E_FIXTURE_PORT ?? "4173");
if (!Number.isInteger(fixturePort) || fixturePort < 1024 || fixturePort > 65535)
  throw new Error("RR_E2E_FIXTURE_PORT must be a port between 1024 and 65535.");
export const FIXTURE_ORIGIN = `http://127.0.0.1:${fixturePort}`;
export type Scenario = {
  slug: string;
  band: "high" | "low" | "medium";
  posting: ParsedPosting;
  sightings: number;
  spanDays: number;
};

export function scenarios(now = new Date()): Scenario[] {
  const make = (
    slug: string,
    band: Scenario["band"],
    title: string,
    company: string,
    age: number,
    descriptionText: string,
    sightings = 1,
    spanDays = 0,
  ): Scenario => ({
    slug,
    band,
    sightings,
    spanDays,
    posting: ParsedPostingSchema.parse({
      title,
      company,
      location: "Toronto, ON",
      descriptionText,
      postedAt: new Date(now.getTime() - age * DAY).toISOString(),
      salary:
        band === "high" ? { min: 110000, max: 140000, currency: "CAD", period: "year" } : undefined,
      source: "generic",
      parsedBy: "generic-jsonld",
      sourceUrl: `${FIXTURE_ORIGIN}/jobs/${slug}`,
    }),
  });
  return [
    make(
      "fresh",
      "high",
      "Platform Engineer",
      "Bramblecrest Analytics",
      2,
      "Join the Platform team reporting to Engineering Manager Rowan Vale. Own TypeScript deployment pipelines, review service reliability metrics weekly, and ship accessible monitoring dashboards. Collaborate with four engineers to reduce build times. Salary CAD 110,000–140,000 per year. The interview process includes a technical conversation and a paid work sample.",
    ),
    make(
      "reposted",
      "low",
      "Data Analyst",
      "Northwind Lumen",
      150,
      "Join the Finance Analytics team. Maintain monthly revenue dashboards, validate SQL models, and report to the analytics manager. Coordinate metric definitions with finance stakeholders. This posting has been observed repeatedly with identical responsibilities.",
      5,
      60,
    ),
    make(
      "vague",
      "medium",
      "Operations Associate",
      "Mapleglass Systems",
      30,
      "We seek a motivated individual to join a dynamic environment. The successful candidate will perform various duties and other tasks as assigned. Strong communication skills and a positive attitude are desirable. Further details will be shared during the interview.",
    ),
  ];
}

export function seedManifest(now = new Date()) {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    fixtures: scenarios(now).map((scenario) => ({
      slug: scenario.slug,
      expectedBand: scenario.band,
      posting: scenario.posting,
      fingerprint: fingerprint(scenario.posting),
      roleKey: roleKey(scenario.posting),
      observations: Array.from({ length: scenario.sightings }, (_, index) => ({
        sourceUrl: scenario.posting.sourceUrl,
        observedAt: new Date(
          now.getTime() -
            ((scenario.spanDays * (scenario.sightings - 1 - index)) /
              Math.max(1, scenario.sightings - 1)) *
              DAY,
        ).toISOString(),
      })),
    })),
  };
}

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function fixtureHtml(scenario: Scenario): string {
  const p = scenario.posting;
  const metadata = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: p.title,
    hiringOrganization: { "@type": "Organization", name: p.company },
    datePosted: p.postedAt,
    description: p.descriptionText,
    jobLocation: { "@type": "Place", name: p.location },
    baseSalary: p.salary
      ? {
          "@type": "MonetaryAmount",
          currency: p.salary.currency,
          value: {
            "@type": "QuantitativeValue",
            minValue: p.salary.min,
            maxValue: p.salary.max,
            unitText: "YEAR",
          },
        }
      : undefined,
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(p.title)} | ${escape(p.company)}</title><script type="application/ld+json">${JSON.stringify(metadata).replaceAll("<", "\\u003c")}</script><style>body{margin:0;background:#f2f5f3;color:#18372d;font:22px/1.6 system-ui}header{padding:28px 8%;border-bottom:1px solid #ccd8d0}main{max-width:1000px;margin:60px auto;padding:40px;background:white;border-radius:18px}h1{font-size:52px;line-height:1.1}small{font-size:16px;color:#53685f}.meta{color:#53685f}p{max-width:850px}a{color:#235d49}</style></head><body><header><strong>${escape(p.company)}</strong> · Careers <small>Fictional demonstration company</small></header><main><p class="meta">${escape(p.location ?? "")} · Full time</p><h1>${escape(p.title)}</h1><p class="meta">Posted ${escape(p.postedAt?.slice(0, 10) ?? "Date unavailable")}</p><h2>About this role</h2><p>${escape(p.descriptionText)}</p><small>This locally served fixture contains no real employer or applicant data.</small></main></body></html>`;
}
