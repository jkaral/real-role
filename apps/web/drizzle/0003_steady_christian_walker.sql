CREATE TABLE "coach_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"invite_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"recipient_id" text,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_shares_invite_hash_unique" UNIQUE("invite_hash")
);
--> statement-breakpoint
ALTER TABLE "coach_shares" ADD CONSTRAINT "coach_shares_application_id_tracked_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."tracked_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_shares" ADD CONSTRAINT "coach_shares_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_shares_app_idx" ON "coach_shares" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "coach_shares_recipient_idx" ON "coach_shares" USING btree ("recipient_id");