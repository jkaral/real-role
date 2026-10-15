import { z } from "zod";
import { IsoDateTimeSchema } from "./posting";
import { ConfidenceSchema } from "./score";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "no_response",
] as const;
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

/** Default days after applying before we nudge the user to follow up. */
export const FOLLOW_UP_DEFAULT_DAYS = 7;

/** A posting the signed-in user chose to track. Belongs to that user only. */
export const TrackedApplicationSchema = z.object({
  id: z.string().min(1),
  postingId: z.string().min(1),
  title: z.string(),
  company: z.string(),
  sourceUrl: z.string(),
  status: ApplicationStatusSchema,
  savedAt: IsoDateTimeSchema,
  appliedAt: IsoDateTimeSchema.nullable(),
  /** When to nudge the user. Null = no reminder. */
  followUpAt: IsoDateTimeSchema.nullable(),
  statusChangedAt: IsoDateTimeSchema,
  notes: z.string().max(5000).nullable(),
  /** Freshness score at the moment of saving, for the dashboard. */
  scoreAtSave: z.number().int().min(0).max(100).nullable(),
  confidenceAtSave: ConfidenceSchema.nullable(),
});
export type TrackedApplication = z.infer<typeof TrackedApplicationSchema>;

/** Follow-up is due when `followUpAt` has passed and the application is still awaiting a reply. */
export function isFollowUpDue(
  app: Pick<TrackedApplication, "status" | "followUpAt">,
  now: Date,
): boolean {
  if (app.followUpAt === null) return false;
  if (app.status !== "applied" && app.status !== "interviewing") return false;
  return new Date(app.followUpAt).getTime() <= now.getTime();
}

export function defaultFollowUpAt(appliedAt: Date, days = FOLLOW_UP_DEFAULT_DAYS): Date {
  return new Date(appliedAt.getTime() + days * 24 * 60 * 60 * 1000);
}
