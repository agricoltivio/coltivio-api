CREATE TYPE "donation_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "membership_payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"email" text NOT NULL,
	"stripe_payment_id" text NOT NULL UNIQUE,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'chf' NOT NULL,
	"status" "donation_status" DEFAULT 'pending'::"donation_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL UNIQUE,
	"stripe_subscription_id" text NOT NULL UNIQUE,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "farm_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL UNIQUE,
	"ends_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_trials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"user_id" uuid,
	"stripe_payment_id" text NOT NULL UNIQUE,
	"stripe_subscription_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'chf' NOT NULL,
	"status" "membership_payment_status" DEFAULT 'pending'::"membership_payment_status" NOT NULL,
	"period_end" timestamp NOT NULL,
	"card_last4" text,
	"card_brand" text,
	"card_exp_month" integer,
	"card_exp_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "farm_subscriptions" ADD CONSTRAINT "farm_subscriptions_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "farm_trials" ADD CONSTRAINT "farm_trials_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "farm members can read own subscription" ON "farm_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("farm_subscriptions"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "farm members can read own trial" ON "farm_trials" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("farm_trials"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "farm members can read own payments" ON "membership_payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("membership_payments"."farm_id" = farm_id());