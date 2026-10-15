ALTER TABLE "bookings" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;