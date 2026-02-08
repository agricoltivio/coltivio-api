ALTER TABLE "crop_rotation_recurrences" RENAME TO "crop_rotation_yearly_recurrences";--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" DROP COLUMN "frequency";--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" DROP COLUMN "by_weekday";--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" DROP COLUMN "by_month_day";--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" DROP COLUMN "count";--> statement-breakpoint
ALTER POLICY "only farm members" ON "crop_rotation_yearly_recurrences" TO "authenticated" USING ("crop_rotation_yearly_recurrences"."farm_id" = farm_id()) WITH CHECK ("crop_rotation_yearly_recurrences"."farm_id" = farm_id());