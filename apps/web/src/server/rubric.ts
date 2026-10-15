import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ParsedPosting } from "@real-role/shared";
import {
  RUBRIC_SYSTEM_PROMPT,
  buildRubricUserMessage,
  parseRubricResponse,
  rubricCacheKey,
  type RubricResult,
} from "@real-role/scoring";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { schema } from "@/db/client";

/**
 * A3: "the cheapest Claude model that does the rubric well". Haiku 5.5 is the cheapest current
 * model; override with RUBRIC_MODEL if evaluation shows it isn't good enough.
 */
export const RUBRIC_MODEL = process.env.RUBRIC_MODEL ?? "claude-haiku-5-5";

// Bounds are enforced by parseRubricResponse; the output schema stays simple.
const ReplySchema = z.object({ score: z.number(), reasons: z.array(z.string()) });

let client: Anthropic | undefined;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 });
  return client;
}

async function callClaude(
  anthropic: Anthropic,
  posting: ParsedPosting,
): Promise<RubricResult | null> {
  const response = await anthropic.messages.parse({
    model: RUBRIC_MODEL,
    max_tokens: 1024,
    system: RUBRIC_SYSTEM_PROMPT,
    output_config: { effort: "low", format: zodOutputFormat(ReplySchema) },
    messages: [{ role: "user", content: buildRubricUserMessage(posting) }],
  });
  // A declined or truncated reply falls back to heuristics only.
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return parseRubricResponse(response.parsed_output);
}

/**
 * LLM specificity rubric, cached by rubric version + fingerprint. Returns null (heuristics only)
 * when no API key is set, the description is empty, or the call fails.
 */
export async function getRubric(
  db: Db,
  posting: ParsedPosting,
  fp: string,
): Promise<RubricResult | null> {
  if (posting.descriptionText.trim().length < 50) return null;
  const key = rubricCacheKey(fp);
  const [cached] = await db
    .select({ result: schema.rubricCache.result })
    .from(schema.rubricCache)
    .where(eq(schema.rubricCache.key, key))
    .limit(1);
  if (cached) return parseRubricResponse(cached.result);

  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    const result = await callClaude(anthropic, posting);
    if (result) {
      await db
        .insert(schema.rubricCache)
        .values({ key, result, model: RUBRIC_MODEL })
        .onConflictDoNothing();
    }
    return result;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.warn(`Rubric call failed (${error.status}); using heuristics only.`);
    } else {
      console.warn("Rubric call failed; using heuristics only.", error);
    }
    return null;
  }
}
