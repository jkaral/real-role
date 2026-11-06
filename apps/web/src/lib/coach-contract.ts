import { z } from "zod";
import { ApplicationStatusSchema, ConfidenceSchema, IsoDateTimeSchema } from "@real-role/shared";
import { JobFactsSchema } from "./job-preferences";

export const InviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const CoachActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), applicationId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("revoke"), shareId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("preview"), token: InviteTokenSchema }),
  z.object({ action: z.literal("accept"), token: InviteTokenSchema }),
]);
export const ManagedShareSchema = z.object({
  id: z.string(),
  expiresAt: IsoDateTimeSchema,
  acceptedAt: IsoDateTimeSchema.nullable(),
  revokedAt: IsoDateTimeSchema.nullable(),
  recipientName: z.string().nullable(),
});
export const InvitePreviewSchema = z.object({
  title: z.string(),
  company: z.string(),
  ownerName: z.string().nullable(),
  expiresAt: IsoDateTimeSchema,
});
export const CoachItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  sourceUrl: z.string(),
  status: ApplicationStatusSchema,
  scoreAtSave: z.number().nullable(),
  confidenceAtSave: ConfidenceSchema.nullable(),
  ownerName: z.string().nullable(),
  facts: JobFactsSchema,
});
export type CoachItem = z.infer<typeof CoachItemSchema>;
