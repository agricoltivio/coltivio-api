CREATE TYPE "forum_thread_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "forum_thread_type" AS ENUM('question', 'feature_request', 'bug_report', 'general');--> statement-breakpoint
CREATE TABLE "forum_moderators" (
	"user_id" uuid PRIMARY KEY,
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"thread_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_replies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "forum_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"type" "forum_thread_type" DEFAULT 'general'::"forum_thread_type" NOT NULL,
	"status" "forum_thread_status" DEFAULT 'open'::"forum_thread_status" NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "forum_replies_thread_id_idx" ON "forum_replies" ("thread_id");--> statement-breakpoint
CREATE INDEX "forum_threads_status_idx" ON "forum_threads" ("status");--> statement-breakpoint
CREATE INDEX "forum_threads_type_idx" ON "forum_threads" ("type");--> statement-breakpoint
ALTER TABLE "forum_moderators" ADD CONSTRAINT "forum_moderators_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_moderators" ADD CONSTRAINT "forum_moderators_granted_by_profiles_id_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_thread_id_forum_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE POLICY "authenticated users can read forum replies" ON "forum_replies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "authenticated users can create forum replies" ON "forum_replies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("forum_replies"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "creator can update own forum replies" ON "forum_replies" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("forum_replies"."created_by" = (select auth.uid())) WITH CHECK ("forum_replies"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "creator can delete own forum replies" ON "forum_replies" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("forum_replies"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "authenticated users can read forum threads" ON "forum_threads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "authenticated users can create forum threads" ON "forum_threads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("forum_threads"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "creator can update own forum threads" ON "forum_threads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("forum_threads"."created_by" = (select auth.uid())) WITH CHECK ("forum_threads"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "creator can delete own forum threads" ON "forum_threads" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("forum_threads"."created_by" = (select auth.uid()));

CREATE VIEW "profile_names" AS (SELECT id, full_name FROM profiles);--> statement-breakpoint
ALTER VIEW profile_names OWNER TO postgres;                                                                                                                                      
GRANT SELECT ON profile_names TO authenticated;    