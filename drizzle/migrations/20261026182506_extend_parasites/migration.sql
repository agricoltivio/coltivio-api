ALTER TYPE "parasite_type" ADD VALUE 'haemonchus' BEFORE 'nematodirus';--> statement-breakpoint
ALTER TABLE "parasite_fec_results" RENAME COLUMN "eggs_per_gram" TO "count_per_gram";