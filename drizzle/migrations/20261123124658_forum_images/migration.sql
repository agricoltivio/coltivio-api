CREATE TABLE "forum_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"storage_path" text NOT NULL UNIQUE,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded_by" uuid,
	"thread_id" uuid,
	"reply_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "forum_images_single_post" CHECK ("thread_id" IS NULL OR "reply_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "forum_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "forum_images_thread_id_idx" ON "forum_images" ("thread_id");--> statement-breakpoint
CREATE INDEX "forum_images_reply_id_idx" ON "forum_images" ("reply_id");--> statement-breakpoint
CREATE INDEX "forum_images_uploaded_by_idx" ON "forum_images" ("uploaded_by");--> statement-breakpoint
ALTER TABLE "forum_images" ADD CONSTRAINT "forum_images_uploaded_by_profiles_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "forum_images" ADD CONSTRAINT "forum_images_thread_id_forum_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "forum_images" ADD CONSTRAINT "forum_images_reply_id_forum_replies_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_replies"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "authenticated users can read forum images" ON "forum_images" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "uploader can manage own forum images" ON "forum_images" AS PERMISSIVE FOR ALL TO "authenticated" USING ("forum_images"."uploaded_by" = (select auth.uid())) WITH CHECK ("forum_images"."uploaded_by" = (select auth.uid()));