ALTER TABLE "plots" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crops" ADD COLUMN "usage_codes" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "plots" ADD COLUMN "local_id" text;--> statement-breakpoint
ALTER TABLE "plots" ADD COLUMN "usage" integer;--> statement-breakpoint
ALTER TABLE "plots" ADD COLUMN "additional_usages" text;--> statement-breakpoint
ALTER TABLE "plots" ADD COLUMN "cutting_date" text;--> statement-breakpoint
ALTER TABLE "public"."crops" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."crop_category";--> statement-breakpoint
CREATE TYPE "public"."crop_category" AS ENUM('grass', 'grain', 'vegetable', 'fruit', 'other');--> statement-breakpoint
ALTER TABLE "public"."crops" ALTER COLUMN "category" SET DATA TYPE "public"."crop_category" USING "category"::"public"."crop_category";