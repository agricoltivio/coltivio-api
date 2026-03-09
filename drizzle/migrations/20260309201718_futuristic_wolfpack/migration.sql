CREATE TABLE "wiki_change_request_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"change_request_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_change_request_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" DROP CONSTRAINT "wiki_change_requests_reviewed_by_profiles_id_fkey";--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "wiki_change_request_status";--> statement-breakpoint
CREATE TYPE "wiki_change_request_status" AS ENUM('draft', 'under_review', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ALTER COLUMN "status" SET DATA TYPE "wiki_change_request_status" USING "status"::"wiki_change_request_status";--> statement-breakpoint
ALTER TABLE "wiki_change_requests" ALTER COLUMN "status" SET DEFAULT 'draft'::"wiki_change_request_status";--> statement-breakpoint
ALTER TABLE "wiki_change_requests" DROP COLUMN "reviewed_by";--> statement-breakpoint
ALTER TABLE "wiki_change_requests" DROP COLUMN "review_notes";--> statement-breakpoint
CREATE INDEX "wiki_cr_notes_cr_id_idx" ON "wiki_change_request_notes" ("change_request_id");--> statement-breakpoint
ALTER TABLE "wiki_change_request_notes" ADD CONSTRAINT "wiki_change_request_notes_QBVGKjGMCvHF_fkey" FOREIGN KEY ("change_request_id") REFERENCES "wiki_change_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wiki_change_request_notes" ADD CONSTRAINT "wiki_change_request_notes_author_id_profiles_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE POLICY "submitter can read and write notes on own change requests" ON "wiki_change_request_notes" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (
        SELECT 1 FROM "wiki_change_requests" wcr
        WHERE wcr.id = "wiki_change_request_notes"."change_request_id"
        AND wcr.submitted_by = auth.uid()
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM "wiki_change_requests" wcr
        WHERE wcr.id = "wiki_change_request_notes"."change_request_id"
        AND wcr.submitted_by = auth.uid()
      ) AND "wiki_change_request_notes"."author_id" = auth.uid());