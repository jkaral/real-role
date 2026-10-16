import { z } from "zod";
import { IsoDateTimeSchema, ParsedPostingSchema, type AtsContext } from "@real-role/shared";
import { adapters, identifyBoard, readOfficialBoard } from "./adapters";

export const EMPLOYER_SOURCE_ROUTE = "/api/employer-source";
const safeLink = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });

// This endpoint needs only matching metadata, never description text.
export const EmployerSourceRequestSchema = z.object({
  posting: ParsedPostingSchema.omit({ descriptionText: true }).extend({
    descriptionText: z.literal("").default(""),
  }),
  boardUrl: z.string().url().max(2048).optional(),
});
export type EmployerSourceRequest = z.infer<typeof EmployerSourceRequestSchema>;
export const EmployerSourceResponseSchema = z.object({
  status: z.enum(["matched", "no_match", "unavailable", "unsupported", "needs_board"]),
  checkedAt: IsoDateTimeSchema,
  boardUrl: safeLink.optional(),
  listing: z
    .object({
      title: z.string(),
      location: z.string().optional(),
      url: safeLink,
      exactListing: z.boolean(),
      reason: z.string(),
    })
    .optional(),
});
export type EmployerSourceResponse = z.infer<typeof EmployerSourceResponseSchema>;

export async function findEmployerSource(
  input: EmployerSourceRequest,
  ctx?: AtsContext,
): Promise<EmployerSourceResponse> {
  const { posting, boardUrl } = EmployerSourceRequestSchema.parse(input);
  const candidate =
    boardUrl ??
    posting.companyCareersUrl ??
    (identifyBoard(posting.sourceUrl) ? posting.sourceUrl : undefined);
  const checkedAt = () => new Date().toISOString();
  if (!candidate) return { status: "needs_board", checkedAt: checkedAt() };
  const snapshot = await readOfficialBoard(candidate, ctx);
  if (snapshot.status === "unsupported") return { status: "unsupported", checkedAt: checkedAt() };
  const base = { boardUrl: snapshot.board.boardUrl, checkedAt: checkedAt() };
  if (snapshot.status === "unavailable") return { ...base, status: "unavailable" };
  const sourceBoard = identifyBoard(posting.sourceUrl);
  const sameBoard =
    sourceBoard?.provider === snapshot.board.provider &&
    sourceBoard.boardToken === snapshot.board.boardToken &&
    sourceBoard.boardUrl === snapshot.board.boardUrl;
  // A provider's identifier is scoped to a board/region, not a global employer identity.
  const target = sameBoard ? posting : { ...posting, externalId: undefined };
  const adapter = adapters.find((item) => item.id === snapshot.board.provider);
  const match = adapter?.findMatch(target, snapshot.roles);
  if (!match?.matched || !match.role) return { ...base, status: "no_match" };
  const link = safeLink.safeParse(match.role.url);
  if (!link.success) return { ...base, status: "unavailable" };
  return {
    ...base,
    status: "matched",
    listing: {
      title: match.role.title,
      location: match.role.location,
      url: link.data,
      exactListing: sameBoard && match.method === "external_id",
      reason: match.reason,
    },
  };
}
