CREATE TYPE "outdoor_schedule_type" AS ENUM('pasture', 'exercise_yard');--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD COLUMN "type" "outdoor_schedule_type" NOT NULL;