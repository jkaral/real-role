import { adapters, detectBoard } from "@real-role/ats";
import type { AtsAdapter, AtsBoard, AtsRole, ParsedPosting } from "@real-role/shared";
import type { CareersEvidence } from "@real-role/scoring";

const ROLES_TTL_MS = 15 * 60 * 1000;
const rolesCache = new Map<string, { roles: AtsRole[]; at: number }>();

/**
 * Where to look for the employer's ATS board. The ATS APIs have no domain directory, so only
 * hosted-board URLs work: the posting's own URL when it's on a hosted board, or a careers link.
 */
export function careersCandidates(posting: ParsedPosting): string[] {
  const out: string[] = [];
  if (posting.companyCareersUrl) out.push(posting.companyCareersUrl);
  if (["greenhouse", "lever", "ashby"].includes(posting.source)) out.push(posting.sourceUrl);
  return [...new Set(out)];
}

async function listRoles(
  adapter: AtsAdapter,
  board: AtsBoard,
  signal: AbortSignal,
): Promise<AtsRole[]> {
  const key = `${board.provider}:${board.boardToken}`;
  const hit = rolesCache.get(key);
  if (hit && Date.now() - hit.at < ROLES_TTL_MS) return hit.roles;
  const roles = await adapter.listOpenRoles(board, { fetch, signal });
  // Empty can mean "lookup failed"; don't cache it.
  if (roles.length > 0) rolesCache.set(key, { roles, at: Date.now() });
  return roles;
}

/**
 * Check the employer's own public job board (A2: official ATS APIs only). Returns null when no
 * board is found or the lookup fails, which the engine treats as unknown.
 */
export async function lookupCareers(
  posting: ParsedPosting,
  timeoutMs = 6000,
): Promise<CareersEvidence | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  for (const candidate of careersCandidates(posting)) {
    try {
      const found = await detectBoard(candidate, { fetch, signal }, adapters);
      if (!found) continue;
      const roles = await listRoles(found.adapter, found.board, signal);
      return { board: found.board, roles, match: found.adapter.findMatch(posting, roles) };
    } catch {
      return null;
    }
  }
  return null;
}
