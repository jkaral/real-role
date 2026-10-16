import { eq, desc } from "drizzle-orm";
import { schema, type Db } from "@/db/client";
import { listApplications } from "./applications";

export async function readInsights(db: Db, userId: string) {
  const [applications, events] = await Promise.all([
    listApplications(db, userId),
    db
      .select({
        id: schema.applicationStageEvents.id,
        applicationId: schema.applicationStageEvents.applicationId,
        fromStatus: schema.applicationStageEvents.fromStatus,
        toStatus: schema.applicationStageEvents.toStatus,
        changedAt: schema.applicationStageEvents.changedAt,
        baseline: schema.applicationStageEvents.baseline,
      })
      .from(schema.applicationStageEvents)
      .innerJoin(
        schema.trackedApplications,
        eq(schema.trackedApplications.id, schema.applicationStageEvents.applicationId),
      )
      .where(eq(schema.trackedApplications.userId, userId))
      .orderBy(desc(schema.applicationStageEvents.changedAt)),
  ]);
  return { applications, events };
}
