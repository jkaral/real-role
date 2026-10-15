/**
 * @real-role/ats — ATS adapters behind the `AtsAdapter` contract (owner: Codex).
 *
 * Phase 1 stub: the export shape below is fixed; implementations replace the stub bodies.
 * Required exports: `greenhouse`, `lever`, `ashby`, `adapters`, `detectBoard`.
 */
import type { AtsAdapter, AtsBoard, AtsContext, AtsProviderId } from "@real-role/shared";

function stubAdapter(id: AtsProviderId): AtsAdapter {
  return {
    id,
    detect: async () => null,
    listOpenRoles: async () => [],
    findMatch: () => ({
      matched: false,
      confidence: 0,
      method: "none",
      reason: "Not checked yet.",
    }),
  };
}

export const greenhouse: AtsAdapter = stubAdapter("greenhouse");
export const lever: AtsAdapter = stubAdapter("lever");
export const ashby: AtsAdapter = stubAdapter("ashby");

/** Adapters tried in order by `detectBoard`. Workday is a later, pluggable addition. */
export const adapters: readonly AtsAdapter[] = [greenhouse, lever, ashby];

/** First board any adapter recognizes, with the adapter that found it. */
export async function detectBoard(
  companyDomainOrUrl: string,
  ctx?: AtsContext,
  candidates: readonly AtsAdapter[] = adapters,
): Promise<{ adapter: AtsAdapter; board: AtsBoard } | null> {
  for (const adapter of candidates) {
    const board = await adapter.detect(companyDomainOrUrl, ctx);
    if (board) return { adapter, board };
  }
  return null;
}
