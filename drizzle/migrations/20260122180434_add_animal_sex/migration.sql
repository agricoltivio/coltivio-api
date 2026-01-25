CREATE TYPE "animal_sex" AS ENUM('male', 'female');--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "sex" "animal_sex" NOT NULL;