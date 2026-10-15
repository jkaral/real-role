import {
  fingerprint,
  type ParsedPosting,
  type ScoreRequest,
  type ScoreResponse,
} from "@real-role/shared";
import { computeScore } from "@real-role/scoring";
import type { Db } from "@/db/client";
import { lookupCareers } from "./careers";
import { fetchPostingPage } from "./fetch-page";
import { HttpError } from "./http";
import {
  getSightings,
  isObservableUrl,
  recordObservation,
  setLastScore,
  upsertPosting,
} from "./postings";
import { getRubric } from "./rubric";
import { UNKNOWN_EMPLOYER, postingFromText } from "./text-posting";

/** Parse fetched HTML like the extension would. jsdom: no scripts run, no subresources load. */
export async function parsePostingHtml(html: string, url: string): Promise<ParsedPosting | null> {
  const [{ JSDOM }, { parsePosting }] = await Promise.all([
    import("jsdom"),
    import("@real-role/parsers"),
  ]);
  const dom = new JSDOM(html, { url });
  try {
    return parsePosting(dom.window.document, url);
  } finally {
    dom.window.close();
  }
}

/** URL mode: fetch the one page the user submitted and parse it. */
export async function postingFromUrl(rawUrl: string): Promise<ParsedPosting> {
  const { html, url } = await fetchPostingPage(rawUrl);
  const posting = await parsePostingHtml(html, url);
  if (!posting) {
    throw new HttpError(
      "unparseable_posting",
      "We couldn't find a single job posting on that page. Paste the posting text instead.",
    );
  }
  return posting;
}

export interface ScoreDeps {
  lookupCareers: typeof lookupCareers;
  getRubric: typeof getRubric;
}
const defaultDeps: ScoreDeps = { lookupCareers, getRubric };

/**
 * Score a posting: store its extracted fields, record an anonymous sighting for real page URLs,
 * gather sightings, ATS evidence and the AI review in parallel, then run the pure engine.
 */
export async function scorePosting(
  db: Db,
  posting: ParsedPosting,
  now: Date,
  deps: ScoreDeps = defaultDeps,
): Promise<ScoreResponse> {
  const fp = fingerprint(posting);
  const row = await upsertPosting(db, posting, now);
  if (isObservableUrl(posting.sourceUrl)) await recordObservation(db, row, posting.sourceUrl, now);

  // Without a real employer name, a roleKey could match unrelated roles; skip history.
  const knownEmployer = posting.company !== UNKNOWN_EMPLOYER;
  const [sightings, careers, rubric] = await Promise.all([
    knownEmployer ? getSightings(db, row.roleKey) : Promise.resolve(null),
    deps.lookupCareers(posting),
    deps.getRubric(db, posting, fp),
  ]);

  const result = computeScore({ posting, now, sightings, careers, rubric });
  await setLastScore(db, row.id, result.score, result.confidence);
  return { postingId: row.id, fingerprint: fp, posting, result };
}

export async function resolvePosting(request: ScoreRequest, now: Date): Promise<ParsedPosting> {
  switch (request.kind) {
    case "parsed":
      return request.posting;
    case "url":
      return postingFromUrl(request.url);
    case "text":
      return postingFromText(request, now);
  }
}
