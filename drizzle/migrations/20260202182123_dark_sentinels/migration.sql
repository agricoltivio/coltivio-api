ALTER TYPE "forage_conservation_method" RENAME TO "conservation_method";--> statement-breakpoint
ALTER TYPE "forage_processing_type" RENAME TO "processing_type";--> statement-breakpoint
ALTER TABLE "forage_harvests" RENAME TO "harvests";--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER POLICY "only farm members" ON "harvests" TO "authenticated" USING ("harvests"."farm_id" = farm_id()) WITH CHECK ("harvests"."farm_id" = farm_id());