CREATE TABLE "app_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"platform" text NOT NULL,
	"version" text NOT NULL,
	"min_supported_version" text,
	"released_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_releases_platform_version_unique" UNIQUE("platform","version")
);
--> statement-breakpoint
ALTER TABLE "app_releases" ENABLE ROW LEVEL SECURITY;