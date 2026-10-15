CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb,
	"link" text,
	"city" "city",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bag_scans" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_sharing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bag_scans" ADD CONSTRAINT "bag_scans_client_id_unique" UNIQUE("client_id");