CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."bag_status" AS ENUM('tagged', 'in_transit', 'stored', 'delivered', 'overdue', 'lost', 'found');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_payment', 'paid', 'accepted', 'in_progress', 'completed', 'paid_out', 'declined', 'cancelled', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."city" AS ENUM('makkah', 'madinah');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('hotel', 'international');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('ar', 'en', 'ur', 'id', 'ms', 'tr');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'packed', 'out_for_delivery', 'shipped', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'succeeded', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('calculated', 'approved', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."place_type" AS ENUM('holy_site', 'shopping', 'gate', 'lost_and_found', 'gathering_point', 'hotel', 'toilet');--> statement-breakpoint
CREATE TYPE "public"."price_model" AS ENUM('per_trip', 'per_hour', 'per_person', 'per_bag', 'per_tag', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."product_section" AS ENUM('makkah_gifts', 'madinah_gifts', 'dates');--> statement-breakpoint
CREATE TYPE "public"."provider_kind" AS ENUM('services', 'shop');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('pending', 'approved', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."provider_type" AS ENUM('company', 'individual');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('pilgrim', 'provider_owner', 'staff', 'admin_ops', 'admin_finance', 'admin_support');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('transport', 'guides', 'photography', 'luggage', 'accessibility', 'heritage_tours');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('driver', 'guide', 'photographer', 'luggage', 'assistant');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"booked" integer DEFAULT 0 NOT NULL,
	"held" integer DEFAULT 0 NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bag_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bag_id" uuid NOT NULL,
	"place_label" text NOT NULL,
	"place_id" uuid,
	"staff_id" uuid NOT NULL,
	"status" "bag_status" NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"correction_of_id" uuid,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_code" text NOT NULL,
	"booking_id" uuid,
	"owner_id" uuid,
	"label" text,
	"status" "bag_status" DEFAULT 'tagged' NOT NULL,
	"expected_next_scan_by" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bags_tag_code_unique" UNIQUE("tag_code")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pilgrim_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"slot_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"options" jsonb,
	"total_halalas" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending_payment' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"accept_by" timestamp with time zone,
	"assigned_staff_id" uuid,
	"meeting_point" text,
	"pickup" jsonb,
	"dropoff" jsonb,
	"needs" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"relation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"relation" text,
	"tracker_tag" text,
	"ble_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" double precision,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lost_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid,
	"channel" text NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"message" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lost_bag_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bag_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "case_status" DEFAULT 'open' NOT NULL,
	"last_scan_id" uuid,
	"notes" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_halalas" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pilgrim_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"delivery_type" "delivery_type" NOT NULL,
	"address" jsonb NOT NULL,
	"country" text,
	"subtotal_halalas" integer NOT NULL,
	"shipping_halalas" integer DEFAULT 0 NOT NULL,
	"gift_wrap_halalas" integer DEFAULT 0 NOT NULL,
	"total_halalas" integer NOT NULL,
	"gift_message" text,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"tracking_number" text,
	"courier" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"order_id" uuid,
	"gateway" text NOT NULL,
	"gateway_ref" text,
	"method" text,
	"amount_halalas" integer NOT NULL,
	"refunded_halalas" integer DEFAULT 0 NOT NULL,
	"status" "payment_status" DEFAULT 'initiated' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_gateway_ref_unique" UNIQUE("gateway_ref")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_halalas" integer NOT NULL,
	"commission_halalas" integer NOT NULL,
	"net_halalas" integer NOT NULL,
	"status" "payout_status" DEFAULT 'calculated' NOT NULL,
	"lines" jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "place_type" NOT NULL,
	"city" "city" NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"hours" jsonb,
	"languages" "language"[] DEFAULT '{}' NOT NULL,
	"price_range" integer,
	"sells" "product_section"[] DEFAULT '{}' NOT NULL,
	"shop_provider_id" uuid,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"section" "product_section" NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb,
	"price_halalas" integer NOT NULL,
	"stock" integer NOT NULL,
	"low_stock_alert" integer DEFAULT 5 NOT NULL,
	"weight_grams" integer NOT NULL,
	"is_food" boolean DEFAULT false NOT NULL,
	"ships_abroad" boolean DEFAULT false NOT NULL,
	"ships_to_countries" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "provider_type" NOT NULL,
	"kind" "provider_kind" DEFAULT 'services' NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"cr_number" text,
	"status" "provider_status" DEFAULT 'pending' NOT NULL,
	"iban_encrypted" text,
	"commission_rate_bps" integer DEFAULT 1500 NOT NULL,
	"commission_free_until" timestamp with time zone,
	"city" "city" NOT NULL,
	"phone" text,
	"documents" jsonb,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"service_id" uuid,
	"provider_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"text" text,
	"language" "language" NOT NULL,
	"reply" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"category" "service_category" NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb,
	"price_halalas" integer NOT NULL,
	"price_model" "price_model" DEFAULT 'fixed' NOT NULL,
	"duration_minutes" integer,
	"options" jsonb,
	"languages_spoken" "language"[] DEFAULT '{}' NOT NULL,
	"service_area" "city" NOT NULL,
	"cancellation_policy" text DEFAULT 'flexible' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"staff_role" "staff_role" NOT NULL,
	"vehicle" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"leader_id" uuid NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_groups_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"language" "language" DEFAULT 'en' NOT NULL,
	"nationality" text,
	"role" "role" DEFAULT 'pilgrim' NOT NULL,
	"accessibility_mode" boolean DEFAULT false NOT NULL,
	"accessibility_needs" text[] DEFAULT '{}' NOT NULL,
	"city" "city",
	"hotel_place_id" uuid,
	"travel_from" timestamp with time zone,
	"travel_to" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "walking_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" "city" NOT NULL,
	"from_place_id" uuid NOT NULL,
	"to_place_id" uuid NOT NULL,
	"distance_m" integer NOT NULL,
	"minutes" integer NOT NULL,
	"accessible" boolean DEFAULT true NOT NULL,
	"path" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_scans" ADD CONSTRAINT "bag_scans_bag_id_bags_id_fk" FOREIGN KEY ("bag_id") REFERENCES "public"."bags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_scans" ADD CONSTRAINT "bag_scans_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_scans" ADD CONSTRAINT "bag_scans_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bags" ADD CONSTRAINT "bags_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bags" ADD CONSTRAINT "bags_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pilgrim_id_users_id_fk" FOREIGN KEY ("pilgrim_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_staff_id_staff_members_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_travel_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_alerts" ADD CONSTRAINT "lost_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_alerts" ADD CONSTRAINT "lost_alerts_group_id_travel_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."travel_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_bag_cases" ADD CONSTRAINT "lost_bag_cases_bag_id_bags_id_fk" FOREIGN KEY ("bag_id") REFERENCES "public"."bags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_bag_cases" ADD CONSTRAINT "lost_bag_cases_last_scan_id_bag_scans_id_fk" FOREIGN KEY ("last_scan_id") REFERENCES "public"."bag_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pilgrim_id_users_id_fk" FOREIGN KEY ("pilgrim_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_providers_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_shop_provider_id_providers_id_fk" FOREIGN KEY ("shop_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_providers_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_groups" ADD CONSTRAINT "travel_groups_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_hotel_place_id_places_id_fk" FOREIGN KEY ("hotel_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walking_routes" ADD CONSTRAINT "walking_routes_from_place_id_places_id_fk" FOREIGN KEY ("from_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walking_routes" ADD CONSTRAINT "walking_routes_to_place_id_places_id_fk" FOREIGN KEY ("to_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "slots_service_start_idx" ON "availability_slots" USING btree ("service_id","starts_at");--> statement-breakpoint
CREATE INDEX "bag_scans_bag_idx" ON "bag_scans" USING btree ("bag_id","scanned_at");--> statement-breakpoint
CREATE INDEX "bookings_pilgrim_idx" ON "bookings" USING btree ("pilgrim_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_service_status_idx" ON "bookings" USING btree ("service_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_uq" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "location_user_idx" ON "location_points" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "orders_pilgrim_idx" ON "orders" USING btree ("pilgrim_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_shop_status_idx" ON "orders" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "otp_phone_created_idx" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_provider_period_uq" ON "payouts" USING btree ("provider_id","period_start");--> statement-breakpoint
CREATE INDEX "places_city_type_idx" ON "places" USING btree ("city","type");--> statement-breakpoint
CREATE INDEX "products_section_idx" ON "products" USING btree ("section","active");--> statement-breakpoint
CREATE INDEX "services_cat_area_idx" ON "services" USING btree ("category","service_area","active");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_user_provider_uq" ON "staff_members" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "status_events_entity_idx" ON "status_events" USING btree ("entity_type","entity_id","at");