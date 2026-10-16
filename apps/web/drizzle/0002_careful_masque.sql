CREATE TABLE "application_stage_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"application_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"baseline" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_stage_events" ADD CONSTRAINT "application_stage_events_application_id_tracked_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."tracked_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_stage_events_app_time_idx" ON "application_stage_events" USING btree ("application_id","changed_at");
--> statement-breakpoint
INSERT INTO "application_stage_events" ("application_id", "from_status", "to_status", "changed_at", "baseline")
SELECT "id", NULL, "status", "status_changed_at", true FROM "tracked_applications";
--> statement-breakpoint
CREATE FUNCTION "real_role_record_stage"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "application_stage_events" ("application_id", "from_status", "to_status", "changed_at")
    VALUES (NEW.id, NULL, NEW.status, NEW.status_changed_at);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO "application_stage_events" ("application_id", "from_status", "to_status", "changed_at")
    VALUES (NEW.id, OLD.status, NEW.status, NEW.status_changed_at);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "real_role_stage_event" AFTER INSERT OR UPDATE OF "status" ON "tracked_applications"
FOR EACH ROW EXECUTE FUNCTION "real_role_record_stage"();
