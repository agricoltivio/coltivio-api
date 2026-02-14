ALTER TABLE "treatments" RENAME COLUMN "date" TO "start_date";--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "end_date" date NOT NULL;