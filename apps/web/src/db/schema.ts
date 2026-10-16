import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";
import type { RubricResult } from "@real-role/scoring";
import type { ApplicationStatus, Confidence, JobSource } from "@real-role/shared";
import type { JobFacts, JobPreferences } from "../lib/job-preferences";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Auth.js (GitHub sign-in). Minimal data: no email or avatar is stored. ----------

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------- Postings and observations (A2: fingerprint, extracted fields, timestamps only) ----------

export const postings = pgTable(
  "postings",
  {
    id: id(),
    fingerprint: text("fingerprint").notNull().unique(),
    roleKey: text("role_key").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    companyDomain: text("company_domain"),
    location: text("location"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    sourceUrl: text("source_url").notNull(),
    source: text("source").$type<JobSource>().notNull(),
    firstSeenAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastScore: integer("last_score"),
    lastConfidence: text("last_confidence").$type<Confidence>(),
  },
  (t) => [index("postings_role_key_idx").on(t.roleKey)],
);

/** One row per role, posting URL and UTC day. No user id: sightings are anonymous. */
export const observations = pgTable(
  "observations",
  {
    id: id(),
    roleKey: text("role_key").notNull(),
    postingId: text("posting_id")
      .notNull()
      .references(() => postings.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    observedDay: date("observed_day", { mode: "string" }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("observations_role_url_day_uq").on(t.roleKey, t.sourceUrl, t.observedDay),
    index("observations_role_key_idx").on(t.roleKey),
  ],
);

export const trackedApplications = pgTable(
  "tracked_applications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postingId: text("posting_id")
      .notNull()
      .references(() => postings.id, { onDelete: "cascade" }),
    status: text("status").$type<ApplicationStatus>().notNull().default("saved"),
    savedAt: createdAt(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    scoreAtSave: integer("score_at_save"),
    confidenceAtSave: text("confidence_at_save").$type<Confidence>(),
  },
  (t) => [uniqueIndex("tracked_user_posting_uq").on(t.userId, t.postingId)],
);

// ---------- Caches and rate limits ----------

export const jobPreferences = pgTable("job_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  values: jsonb("values").$type<JobPreferences>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trackedJobFacts = pgTable("tracked_job_facts", {
  applicationId: text("application_id")
    .primaryKey()
    .references(() => trackedApplications.id, { onDelete: "cascade" }),
  values: jsonb("values").$type<JobFacts>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applicationStageEvents = pgTable(
  "application_stage_events",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    applicationId: text("application_id")
      .notNull()
      .references(() => trackedApplications.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<ApplicationStatus>(),
    toStatus: text("to_status").$type<ApplicationStatus>().notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    baseline: boolean("baseline").notNull().default(false),
  },
  (t) => [index("application_stage_events_app_time_idx").on(t.applicationId, t.changedAt)],
);

export const coachShares = pgTable(
  "coach_shares",
  {
    id: id(),
    applicationId: text("application_id")
      .notNull()
      .references(() => trackedApplications.id, { onDelete: "cascade" }),
    inviteHash: text("invite_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    recipientId: text("recipient_id").references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("coach_shares_app_idx").on(t.applicationId),
    index("coach_shares_recipient_idx").on(t.recipientId),
  ],
);

/** LLM rubric results keyed by rubric version + fingerprint (A3: cache by fingerprint). */
export const rubricCache = pgTable("rubric_cache", {
  key: text("key").primaryKey(),
  result: jsonb("result").$type<RubricResult>().notNull(),
  model: text("model").notNull(),
  createdAt: createdAt(),
});

/** Fixed-window counters. `key` is "<bucket>:<client>", `window` the window start (epoch s). */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    window: integer("window").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.window] })],
);
