ALTER TABLE "sponsorship_types" RENAME TO "sponsorship_programs";--> statement-breakpoint
ALTER TABLE "sponsorships" RENAME COLUMN "sponsorship_type_id" TO "sponsorship_program_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "stock";--> statement-breakpoint
ALTER POLICY "only farm members" ON "sponsorship_programs" TO "authenticated" USING ("sponsorship_programs"."farm_id" = farm_id()) WITH CHECK ("sponsorship_programs"."farm_id" = farm_id());