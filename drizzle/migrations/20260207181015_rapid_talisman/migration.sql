CREATE TYPE "animal_category" AS ENUM('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'B1', 'B2', 'B3', 'C1', 'C2', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3', 'E4', 'F1', 'F2');--> statement-breakpoint
ALTER TABLE "harvests" RENAME COLUMN "produced_units" TO "number_of_units";--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "category" "animal_category";