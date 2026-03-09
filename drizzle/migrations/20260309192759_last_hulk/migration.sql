ALTER TABLE "wiki_change_requests" ADD COLUMN "proposed_slug" text;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ADD COLUMN "proposed_category_id" uuid;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ADD COLUMN "proposed_farm_id" uuid;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ALTER COLUMN "entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ADD CONSTRAINT "wiki_change_requests_h0iEEVu09dfg_fkey" FOREIGN KEY ("proposed_category_id") REFERENCES "wiki_categories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ADD CONSTRAINT "wiki_change_requests_proposed_farm_id_farms_id_fkey" FOREIGN KEY ("proposed_farm_id") REFERENCES "farms"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" DROP CONSTRAINT "wiki_change_requests_entry_id_wiki_entries_id_fkey", ADD CONSTRAINT "wiki_change_requests_entry_id_wiki_entries_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "wiki_entries"("id") ON DELETE SET NULL;