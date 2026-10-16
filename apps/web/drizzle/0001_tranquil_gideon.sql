CREATE TABLE "job_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_job_facts" (
	"application_id" text PRIMARY KEY NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_preferences" ADD CONSTRAINT "job_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_job_facts" ADD CONSTRAINT "tracked_job_facts_application_id_tracked_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."tracked_applications"("id") ON DELETE cascade ON UPDATE no action;