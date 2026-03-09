ALTER TABLE "wiki_entries" DROP CONSTRAINT "wiki_entries_slug_key";--> statement-breakpoint
DROP INDEX "wiki_entries_slug_idx";--> statement-breakpoint
ALTER TABLE "wiki_change_requests" DROP COLUMN "proposed_slug";--> statement-breakpoint
ALTER TABLE "wiki_entries" DROP COLUMN "slug";