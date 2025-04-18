ALTER TABLE "fertilizers" ADD COLUMN "default_spreader_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizers" ADD CONSTRAINT "fertilizers_default_spreader_id_fertilizer_spreaders_id_fk" FOREIGN KEY ("default_spreader_id") REFERENCES "public"."fertilizer_spreaders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
