CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"to_user_id" uuid,
	"to_address" text,
	"template" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked" integer NOT NULL,
	"mismatches" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "live_location" jsonb;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_user_idx" ON "outbox_messages" USING btree ("to_user_id","created_at");