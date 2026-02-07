CREATE TYPE "crop_protection_application_unit" AS ENUM('load', 'bag', 'total_amount', 'amount_per_hectare', 'other');--> statement-breakpoint
CREATE TYPE "fertilizer_application_unit" AS ENUM('load', 'bag', 'total_amount', 'amount_per_hectare', 'other');--> statement-breakpoint
CREATE TYPE "frequency" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "harvest_unit" AS ENUM('load', 'square_bale', 'round_bale', 'crate', 'total_amount', 'other');--> statement-breakpoint
CREATE TYPE "weekday" AS ENUM('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU');--> statement-breakpoint
CREATE TABLE "crop_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"waiting_time_in_years" integer DEFAULT 0 NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "crop_families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "crop_protection_application_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"method" "crop_protection_application_method" NOT NULL,
	"unit" "crop_protection_application_unit" NOT NULL,
	"custom_unit" text,
	"amount_per_unit" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crop_protection_application_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "crop_rotation_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"crop_rotation_id" uuid NOT NULL,
	"frequency" "frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_weekday" "weekday"[],
	"by_month_day" integer,
	"until" date,
	"count" integer
);
--> statement-breakpoint
ALTER TABLE "crop_rotation_recurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fertilizer_application_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fertilizer_id" uuid NOT NULL,
	"unit" "fertilizer_application_unit" NOT NULL,
	"method" "fertilization_method",
	"amount_per_unit" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "harvest_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "harvest_unit" NOT NULL,
	"kilos_per_unit" real NOT NULL,
	"conservation_method" "conservation_method"
);
--> statement-breakpoint
ALTER TABLE "harvest_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "herds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"outdoor_schedule_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "herds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outdoor_schedule_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"outdoor_schedule_id" uuid NOT NULL,
	"frequency" "frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_weekday" "weekday"[],
	"by_month_day" integer,
	"until" date,
	"count" integer
);
--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outdoor_shedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TYPE "tillage_action" ADD VALUE 'custom';--> statement-breakpoint
ALTER TABLE "tillages" ALTER COLUMN "action" SET DATA TYPE "tillage_action" USING "action"::"tillage_action";--> statement-breakpoint
CREATE TABLE "tillage_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reason" "tillage_reason" NOT NULL,
	"action" "tillage_action" NOT NULL,
	"custom_action" text
);
--> statement-breakpoint
ALTER TABLE "tillage_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "only farm members" ON "animal_groups";--> statement-breakpoint
DROP POLICY "only farm members" ON "crop_protection_equipment";--> statement-breakpoint
DROP POLICY "only farm members" ON "fertilizer_spreaders";--> statement-breakpoint
DROP POLICY "only farm members" ON "harvesting_machinery";--> statement-breakpoint
DROP POLICY "only farm members" ON "outdoor_journal_entries";--> statement-breakpoint
DROP POLICY "only farm members" ON "tillage_equipment";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "crop_protection_applications_equipment_id_crop_protection_equip";--> statement-breakpoint
ALTER TABLE "crop_protection_products" DROP CONSTRAINT "crop_protection_products_default_equipment_id_crop_protection_e";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" DROP CONSTRAINT "fertilizer_applications_spreader_id_fertilizer_spreaders_id_fk";--> statement-breakpoint
ALTER TABLE "fertilizers" DROP CONSTRAINT "fertilizers_default_spreader_id_fertilizer_spreaders_id_fk";--> statement-breakpoint
ALTER TABLE "harvests" DROP CONSTRAINT "forage_harvests_machinery_id_harvesting_machinery_id_fk";--> statement-breakpoint
ALTER TABLE "outdoor_journal_entries" DROP CONSTRAINT "outdoor_journal_entries_animal_group_id_animal_groups_id_fkey";--> statement-breakpoint
ALTER TABLE "tillages" DROP CONSTRAINT "tillages_equipment_id_tillage_equipment_id_fk";--> statement-breakpoint
DROP TABLE "animal_groups";--> statement-breakpoint
DROP TABLE "crop_protection_equipment";--> statement-breakpoint
DROP TABLE "fertilizer_spreaders";--> statement-breakpoint
DROP TABLE "harvesting_machinery";--> statement-breakpoint
DROP TABLE "outdoor_journal_entries";--> statement-breakpoint
DROP TABLE "tillage_equipment";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" RENAME COLUMN "amount_per_application" TO "amount_per_unit";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" RENAME COLUMN "number_of_applications" TO "number_of_units";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" RENAME COLUMN "amount_per_application" TO "amount_per_unit";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" RENAME COLUMN "number_of_applications" TO "number_of_units";--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "herd_id" uuid;--> statement-breakpoint
ALTER TABLE "crops" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "crops" ADD COLUMN "waiting_time_in_years" integer;--> statement-breakpoint
ALTER TABLE "harvests" ADD COLUMN "unit" "harvest_unit" NOT NULL;--> statement-breakpoint
ALTER TABLE "tillages" ADD COLUMN "custom_action" text;--> statement-breakpoint
ALTER TABLE "tillages" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint


ALTER TABLE "crop_protection_applications" DROP COLUMN "equipment_id";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" DROP COLUMN "spreader_id";--> statement-breakpoint
ALTER TABLE "harvests" DROP COLUMN "processing_type";--> statement-breakpoint
ALTER TABLE "harvests" DROP COLUMN "machinery_id";--> statement-breakpoint
ALTER TABLE "tillages" DROP COLUMN "equipment_id";--> statement-breakpoint
ALTER TABLE "crop_protection_products" DROP COLUMN "default_equipment_id";--> statement-breakpoint
ALTER TABLE "fertilizers" DROP COLUMN "default_spreader_id";--> statement-breakpoint
ALTER TABLE "animals" ALTER COLUMN "date_of_birth" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ALTER COLUMN "method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ALTER COLUMN "unit" SET DATA TYPE "crop_protection_application_unit" USING "unit"::text::"crop_protection_application_unit";--> statement-breakpoint
ALTER TABLE "crop_rotations" ALTER COLUMN "to_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ALTER COLUMN "unit" SET DATA TYPE "fertilizer_application_unit" USING "unit"::text::"fertilizer_application_unit";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ALTER COLUMN "method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "harvests" ALTER COLUMN "conservation_method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_herd_id_herds_id_fkey" FOREIGN KEY ("herd_id") REFERENCES "herds"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "crop_families" ADD CONSTRAINT "crop_families_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_protection_application_presets" ADD CONSTRAINT "crop_protection_application_presets_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_recurrences" ADD CONSTRAINT "crop_rotation_recurrences_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_recurrences" ADD CONSTRAINT "crop_rotation_recurrences_3Zf28Qy8GZcc_fkey" FOREIGN KEY ("crop_rotation_id") REFERENCES "crop_rotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_family_id_crop_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "crop_families"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" ADD CONSTRAINT "fertilizer_application_presets_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" ADD CONSTRAINT "fertilizer_application_presets_S9oxn23jSRLF_fkey" FOREIGN KEY ("fertilizer_id") REFERENCES "fertilizers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "harvest_presets" ADD CONSTRAINT "harvest_presets_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herds" ADD CONSTRAINT "herds_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herds" ADD CONSTRAINT "herds_outdoor_schedule_id_outdoor_shedules_id_fkey" FOREIGN KEY ("outdoor_schedule_id") REFERENCES "outdoor_shedules"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" ADD CONSTRAINT "outdoor_schedule_recurrences_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" ADD CONSTRAINT "outdoor_schedule_recurrences_phiXhM6XuCtO_fkey" FOREIGN KEY ("outdoor_schedule_id") REFERENCES "outdoor_shedules"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD CONSTRAINT "outdoor_shedules_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tillage_presets" ADD CONSTRAINT "tillage_presets_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_families" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_families"."farm_id" = farm_id()) WITH CHECK ("crop_families"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_protection_application_presets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_protection_application_presets"."farm_id" = farm_id()) WITH CHECK ("crop_protection_application_presets"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_rotation_recurrences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_rotation_recurrences"."farm_id" = farm_id()) WITH CHECK ("crop_rotation_recurrences"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "fertilizer_application_presets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fertilizer_application_presets"."farm_id" = farm_id()) WITH CHECK ("fertilizer_application_presets"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "harvest_presets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("harvest_presets"."farm_id" = farm_id()) WITH CHECK ("harvest_presets"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "herds" AS PERMISSIVE FOR ALL TO "authenticated" USING ("herds"."farm_id" = farm_id()) WITH CHECK ("herds"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "outdoor_schedule_recurrences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("outdoor_schedule_recurrences"."farm_id" = farm_id()) WITH CHECK ("outdoor_schedule_recurrences"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "outdoor_shedules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("outdoor_shedules"."farm_id" = farm_id()) WITH CHECK ("outdoor_shedules"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "tillage_presets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tillage_presets"."farm_id" = farm_id()) WITH CHECK ("tillage_presets"."farm_id" = farm_id());--> statement-breakpoint
DROP TYPE "processing_type";