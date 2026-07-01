CREATE TYPE "animal_category" AS ENUM('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'B1', 'B2', 'B3', 'C1', 'C2', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3', 'E4', 'F1', 'F2');--> statement-breakpoint
CREATE TYPE "animal_sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "animal_type" AS ENUM('goat', 'sheep', 'cow', 'horse', 'donkey', 'pig', 'deer');--> statement-breakpoint
CREATE TYPE "animal_usage" AS ENUM('milk', 'other');--> statement-breakpoint
CREATE TYPE "conservation_method" AS ENUM('dried', 'silage', 'haylage', 'other', 'none');--> statement-breakpoint
CREATE TYPE "crop_category" AS ENUM('grass', 'grain', 'vegetable', 'fruit', 'other');--> statement-breakpoint
CREATE TYPE "crop_protection_application_method" AS ENUM('spraying', 'misting', 'broadcasting', 'injecting', 'other');--> statement-breakpoint
CREATE TYPE "crop_protection_application_unit" AS ENUM('load', 'bag', 'total_amount', 'amount_per_hectare', 'other');--> statement-breakpoint
CREATE TYPE "crop_protection_unit" AS ENUM('ml', 'l', 'g', 'kg');--> statement-breakpoint
CREATE TYPE "death_reason" AS ENUM('died', 'slaughtered');--> statement-breakpoint
CREATE TYPE "dose_per_unit" AS ENUM('kg', 'animal', 'day', 'total_amount');--> statement-breakpoint
CREATE TYPE "drug_dose_unit" AS ENUM('tablet', 'capsule', 'patch', 'dose', 'mg', 'mcg', 'g', 'ml', 'drop');--> statement-breakpoint
CREATE TYPE "farm_permission_feature" AS ENUM('animals', 'field_calendar', 'commerce', 'tasks');--> statement-breakpoint
CREATE TYPE "farm_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "fertilization_method" AS ENUM('spray', 'spread', 'other');--> statement-breakpoint
CREATE TYPE "fertilizer_application_unit" AS ENUM('load', 'bag', 'total_amount', 'amount_per_hectare', 'other');--> statement-breakpoint
CREATE TYPE "fertilizer_type" AS ENUM('mineral', 'organic');--> statement-breakpoint
CREATE TYPE "fertilizer_unit" AS ENUM('l', 'kg', 'dt', 't');--> statement-breakpoint
CREATE TYPE "frequency" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "harvest_unit" AS ENUM('load', 'square_bale', 'round_bale', 'crate', 'total_amount', 'other');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('pending', 'confirmed', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "outdoor_schedule_type" AS ENUM('pasture', 'exercise_yard');--> statement-breakpoint
CREATE TYPE "payment_method" AS ENUM('cash', 'bank_transfer', 'twint', 'card', 'other');--> statement-breakpoint
CREATE TYPE "preferred_communication" AS ENUM('email', 'phone', 'whatsapp');--> statement-breakpoint
CREATE TYPE "product_category" AS ENUM('meat', 'vegetables', 'dairy', 'eggs', 'other');--> statement-breakpoint
CREATE TYPE "product_unit" AS ENUM('kg', 'g', 'piece', 'bunch', 'liter');--> statement-breakpoint
CREATE TYPE "task_link_type" AS ENUM('animal', 'plot', 'contact', 'order', 'wiki_entry', 'treatment', 'herd');--> statement-breakpoint
CREATE TYPE "task_status" AS ENUM('todo', 'done');--> statement-breakpoint
CREATE TYPE "tillage_action" AS ENUM('plowing', 'tilling', 'harrowing', 'rolling', 'rotavating', 'weed_harrowing', 'hoeing', 'flame_weeding', 'custom');--> statement-breakpoint
CREATE TYPE "tillage_reason" AS ENUM('weed_control', 'soil_loosening', 'other');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('ADMIN', 'USER', 'CONTRACTOR');--> statement-breakpoint
CREATE TYPE "weekday" AS ENUM('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU');--> statement-breakpoint
CREATE TYPE "wiki_entry_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "wiki_locale" AS ENUM('de', 'en', 'it', 'fr');--> statement-breakpoint
CREATE TABLE "animal_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"animalId" uuid NOT NULL,
	"farmId" uuid NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"content" text,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_journal_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"journalEntryId" uuid NOT NULL,
	"storagePath" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"animalId" uuid NOT NULL,
	"treatmentId" uuid NOT NULL,
	"farmId" uuid NOT NULL,
	CONSTRAINT "animal_treatments_unique" UNIQUE("animalId","treatmentId")
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "animal_type" NOT NULL,
	"usage" "animal_usage" NOT NULL,
	"sex" "animal_sex" NOT NULL,
	"dateOfBirth" date NOT NULL,
	"registered" boolean DEFAULT false NOT NULL,
	"earTagId" uuid,
	"motherId" uuid,
	"fatherId" uuid,
	"dateOfDeath" date,
	"deathReason" "death_reason",
	"herdId" uuid
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"street" text,
	"city" text,
	"zip" text,
	"phone" text,
	"email" text,
	"preferredCommunication" "preferred_communication",
	"labels" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"waitingTimeInYears" integer DEFAULT 0 NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "crop_protection_application_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"method" "crop_protection_application_method",
	"unit" "crop_protection_application_unit" NOT NULL,
	"customUnit" text,
	"amountPerUnit" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_protection_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"plotId" uuid NOT NULL,
	"dateTime" timestamp NOT NULL,
	"productId" uuid NOT NULL,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"method" "crop_protection_application_method",
	"unit" "crop_protection_application_unit" NOT NULL,
	"amountPerUnit" real NOT NULL,
	"numberOfUnits" real NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "crop_protection_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "crop_protection_unit" NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "crop_rotation_draft_plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"draftPlanPlotId" uuid NOT NULL,
	"cropId" uuid NOT NULL,
	"sowingDate" date,
	"fromDate" date NOT NULL,
	"toDate" date NOT NULL,
	"recurrenceInterval" integer,
	"recurrenceUntil" date
);
--> statement-breakpoint
CREATE TABLE "crop_rotation_draft_plan_plots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"draftPlanId" uuid NOT NULL,
	"plotId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_rotation_draft_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_rotation_yearly_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"crop_rotation_id" uuid NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"until" date
);
--> statement-breakpoint
CREATE TABLE "crop_rotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"plotId" uuid NOT NULL,
	"cropId" uuid NOT NULL,
	"sowingDate" date,
	"fromDate" date NOT NULL,
	"toDate" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "crop_category" NOT NULL,
	"familyId" uuid,
	"variety" text,
	"waitingTimeInYears" integer,
	"usageCodes" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "custom_outdoor_journal_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"animalId" uuid NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date,
	"category" "animal_category" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drug_treatment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"drugId" uuid NOT NULL,
	"animalType" "animal_type" NOT NULL,
	"doseUnit" "drug_dose_unit" NOT NULL,
	"doseValue" real NOT NULL,
	"dosePerUnit" "dose_per_unit" NOT NULL,
	"milkWaitingDays" integer NOT NULL,
	"meatWaitingDays" integer NOT NULL,
	"organsWaitingDays" integer NOT NULL,
	CONSTRAINT "drug_treatment_drug_animal_unique" UNIQUE("drugId","animalType")
);
--> statement-breakpoint
CREATE TABLE "drugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"isAntibiotic" boolean DEFAULT false NOT NULL,
	"criticalAntibiotic" boolean NOT NULL,
	"receivedFrom" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ear_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"number" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_member_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"feature" "farm_permission_feature" NOT NULL,
	"access" text DEFAULT 'none' NOT NULL,
	CONSTRAINT "farm_member_permissions_user_feature_unique" UNIQUE("userId","feature")
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"federalId" text,
	"tvdId" text,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"location" geometry(Point,4326)
);
--> statement-breakpoint
CREATE TABLE "federal_farm_plots" (
	"id" integer PRIMARY KEY,
	"farm_id" text NOT NULL,
	"local_id" text,
	"usage" integer NOT NULL,
	"size" integer NOT NULL,
	"cut_date" date,
	"canton" text NOT NULL,
	"geometry" geometry(MultiPolygon,4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fertilizer_application_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"fertilizerId" uuid NOT NULL,
	"unit" "fertilizer_application_unit" NOT NULL,
	"method" "fertilization_method",
	"amountPerUnit" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fertilizer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid NOT NULL,
	"plotId" uuid NOT NULL,
	"date" date NOT NULL,
	"method" "fertilization_method",
	"unit" "fertilizer_application_unit" NOT NULL,
	"amountPerUnit" real NOT NULL,
	"numberOfUnits" real NOT NULL,
	"fertilizerId" uuid NOT NULL,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "fertilizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "fertilizer_type" NOT NULL,
	"unit" "fertilizer_unit" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvest_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "harvest_unit" NOT NULL,
	"kilosPerUnit" real NOT NULL,
	"conservationMethod" "conservation_method"
);
--> statement-breakpoint
CREATE TABLE "harvests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"date" date NOT NULL,
	"plotId" uuid NOT NULL,
	"cropId" uuid NOT NULL,
	"conservationMethod" "conservation_method",
	"unit" "harvest_unit" NOT NULL,
	"kilosPerUnit" real NOT NULL,
	"numberOfUnits" real NOT NULL,
	"harvestCount" integer,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "herd_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"animalId" uuid NOT NULL,
	"herdId" uuid NOT NULL,
	"fromDate" date NOT NULL,
	"toDate" date
);
--> statement-breakpoint
CREATE TABLE "herds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"senderName" text DEFAULT '' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"phone" text,
	"email" text,
	"website" text,
	"iban" text,
	"bankName" text,
	"paymentTermsDays" integer DEFAULT 30 NOT NULL,
	"introText" text,
	"closingText" text,
	"logoData" bytea,
	"logoMimeType" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_settings_farm_name_unique" UNIQUE("farmId","name")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"orderId" uuid NOT NULL,
	"productId" uuid NOT NULL,
	"quantity" real NOT NULL,
	"unitPrice" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"contactId" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending'::"order_status" NOT NULL,
	"orderDate" date NOT NULL,
	"shippingDate" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "outdoor_schedule_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"outdoor_schedule_id" uuid NOT NULL,
	"frequency" "frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_weekday" "weekday"[],
	"by_month_day" integer,
	"until" date,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "outdoor_shedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"herdId" uuid NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date,
	"type" "outdoor_schedule_type" NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"communalId" text NOT NULL,
	"gisId" integer,
	"geometry" geometry(MultiPolygon,4326),
	"size" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"contactId" uuid NOT NULL,
	"sponsorshipId" uuid,
	"orderId" uuid,
	"date" date NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"method" "payment_method" NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "plot_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"plotId" uuid NOT NULL,
	"farmId" uuid NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"content" text,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_journal_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"journalEntryId" uuid NOT NULL,
	"storagePath" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"localId" text,
	"usage" integer,
	"cuttingDate" date,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "product_category" NOT NULL,
	"unit" "product_unit" NOT NULL,
	"pricePerUnit" real NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"passwordHash" text,
	"fullName" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'de' NOT NULL,
	"farmId" uuid,
	"farmRole" "farm_role"
);
--> statement-breakpoint
CREATE TABLE "sponsorship_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"yearlyCost" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"contactId" uuid NOT NULL,
	"animalId" uuid NOT NULL,
	"sponsorshipProgramId" uuid NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date,
	"notes" text,
	"preferredCommunication" "preferred_communication"
);
--> statement-breakpoint
CREATE TABLE "task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"taskId" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"dueDate" date,
	"done" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"taskId" uuid NOT NULL,
	"linkType" "task_link_type" NOT NULL,
	"linkedId" uuid NOT NULL,
	CONSTRAINT "task_links_unique" UNIQUE("taskId","linkType","linkedId")
);
--> statement-breakpoint
CREATE TABLE "task_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"taskId" uuid NOT NULL,
	"frequency" "frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_weekday" "weekday"[],
	"by_month_day" integer,
	"until" date,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "task_status" DEFAULT 'todo'::"task_status" NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"assigneeId" uuid,
	"dueDate" date,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid
);
--> statement-breakpoint
CREATE TABLE "tillage_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"name" text NOT NULL,
	"reason" "tillage_reason",
	"action" "tillage_action" NOT NULL,
	"customAction" text
);
--> statement-breakpoint
CREATE TABLE "tillages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"plotId" uuid NOT NULL,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"reason" "tillage_reason",
	"action" "tillage_action" NOT NULL,
	"customAction" text,
	"date" date NOT NULL,
	"additionalNotes" text
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farmId" uuid NOT NULL,
	"drugId" uuid,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"drugDoseUnit" "drug_dose_unit",
	"drugDoseValue" real,
	"drugDosePerUnit" "dose_per_unit",
	"drugReceivedFrom" text,
	"isAntibiotic" boolean DEFAULT false NOT NULL,
	"criticalAntibiotic" boolean NOT NULL,
	"antibiogramAvailable" boolean NOT NULL,
	"milk_usable_date" date,
	"meat_usable_date" date,
	"organs_usable_date" date,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid
);
--> statement-breakpoint
CREATE TABLE "wiki_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_category_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"categoryId" uuid NOT NULL,
	"locale" "wiki_locale" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "wiki_category_translations_unique" UNIQUE("categoryId","locale")
);
--> statement-breakpoint
CREATE TABLE "wiki_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"status" "wiki_entry_status" DEFAULT 'draft'::"wiki_entry_status" NOT NULL,
	"createdBy" uuid NOT NULL,
	"farmId" uuid NOT NULL,
	"categoryId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_entry_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entryId" uuid NOT NULL,
	"storagePath" text NOT NULL,
	"altText" text,
	"uploadedBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_entry_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entryId" uuid NOT NULL,
	"tagId" uuid NOT NULL,
	CONSTRAINT "wiki_entry_tags_unique" UNIQUE("entryId","tagId")
);
--> statement-breakpoint
CREATE TABLE "wiki_entry_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entryId" uuid NOT NULL,
	"locale" "wiki_locale" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"updatedBy" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_entry_translations_entry_locale_unique" UNIQUE("entryId","locale")
);
--> statement-breakpoint
CREATE TABLE "wiki_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL UNIQUE,
	"slug" text NOT NULL UNIQUE,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "animal_journal_entries_animal_id_idx" ON "animal_journal_entries" ("animalId");--> statement-breakpoint
CREATE INDEX "animal_journal_images_entry_id_idx" ON "animal_journal_images" ("journalEntryId");--> statement-breakpoint
CREATE INDEX "animal_treatments_animal_id_idx" ON "animal_treatments" ("animalId");--> statement-breakpoint
CREATE INDEX "animal_treatments_treatment_id_idx" ON "animal_treatments" ("treatmentId");--> statement-breakpoint
CREATE INDEX "custom_outdoor_journal_categories_animal_id_idx" ON "custom_outdoor_journal_categories" ("animalId");--> statement-breakpoint
CREATE INDEX "drug_treatment_drug_id_idx" ON "drug_treatment" ("drugId");--> statement-breakpoint
CREATE INDEX "federal_farm_plots_geometries_idx" ON "federal_farm_plots" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "federal_farm_id_idx" ON "federal_farm_plots" USING gin ("farm_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "herd_memberships_animal_id_idx" ON "herd_memberships" ("animalId");--> statement-breakpoint
CREATE INDEX "herd_memberships_herd_id_idx" ON "herd_memberships" ("herdId");--> statement-breakpoint
CREATE INDEX "parcel_geometries_idx" ON "parcels" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "parcel_gisid_idx" ON "parcels" ("gisId");--> statement-breakpoint
CREATE INDEX "plot_journal_entries_plot_id_idx" ON "plot_journal_entries" ("plotId");--> statement-breakpoint
CREATE INDEX "plot_journal_images_entry_id_idx" ON "plot_journal_images" ("journalEntryId");--> statement-breakpoint
CREATE INDEX "plot_geometries_idx" ON "plots" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "task_checklist_items_task_id_idx" ON "task_checklist_items" ("taskId");--> statement-breakpoint
CREATE INDEX "task_links_task_id_idx" ON "task_links" ("taskId");--> statement-breakpoint
CREATE INDEX "treatments_drug_id_idx" ON "treatments" ("drugId");--> statement-breakpoint
CREATE INDEX "treatments_date_idx" ON "treatments" ("startDate");--> statement-breakpoint
CREATE INDEX "wiki_category_translations_category_id_idx" ON "wiki_category_translations" ("categoryId");--> statement-breakpoint
CREATE INDEX "wiki_entries_status_idx" ON "wiki_entries" ("status");--> statement-breakpoint
CREATE INDEX "wiki_entry_images_entry_id_idx" ON "wiki_entry_images" ("entryId");--> statement-breakpoint
CREATE INDEX "wiki_entry_translations_entry_id_idx" ON "wiki_entry_translations" ("entryId");--> statement-breakpoint
ALTER TABLE "animal_journal_entries" ADD CONSTRAINT "animal_journal_entries_animalId_animals_id_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_journal_entries" ADD CONSTRAINT "animal_journal_entries_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_journal_entries" ADD CONSTRAINT "animal_journal_entries_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_animalId_animals_id_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_treatmentId_treatments_id_fkey" FOREIGN KEY ("treatmentId") REFERENCES "treatments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_earTagId_ear_tags_id_fkey" FOREIGN KEY ("earTagId") REFERENCES "ear_tags"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_herdId_herds_id_fkey" FOREIGN KEY ("herdId") REFERENCES "herds"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_mother_fk" FOREIGN KEY ("motherId") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_father_fk" FOREIGN KEY ("fatherId") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_families" ADD CONSTRAINT "crop_families_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_protection_application_presets" ADD CONSTRAINT "crop_protection_application_presets_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_zFlMloaMoSYr_fkey" FOREIGN KEY ("productId") REFERENCES "crop_protection_products"("id");--> statement-breakpoint
ALTER TABLE "crop_protection_products" ADD CONSTRAINT "crop_protection_products_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" ADD CONSTRAINT "crop_rotation_draft_plan_entries_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" ADD CONSTRAINT "crop_rotation_draft_plan_entries_YYkTTUfeTQwI_fkey" FOREIGN KEY ("draftPlanPlotId") REFERENCES "crop_rotation_draft_plan_plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" ADD CONSTRAINT "crop_rotation_draft_plan_entries_cropId_crops_id_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id");--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" ADD CONSTRAINT "crop_rotation_draft_plan_plots_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" ADD CONSTRAINT "crop_rotation_draft_plan_plots_L5lj7ISJOqL9_fkey" FOREIGN KEY ("draftPlanId") REFERENCES "crop_rotation_draft_plans"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" ADD CONSTRAINT "crop_rotation_draft_plan_plots_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plans" ADD CONSTRAINT "crop_rotation_draft_plans_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" ADD CONSTRAINT "crop_rotation_yearly_recurrences_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" ADD CONSTRAINT "crop_rotation_yearly_recurrences_8wTBnwqBsUgZ_fkey" FOREIGN KEY ("crop_rotation_id") REFERENCES "crop_rotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_cropId_crops_id_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id");--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_familyId_crop_families_id_fkey" FOREIGN KEY ("familyId") REFERENCES "crop_families"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "custom_outdoor_journal_categories" ADD CONSTRAINT "custom_outdoor_journal_categories_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_outdoor_journal_categories" ADD CONSTRAINT "custom_outdoor_journal_categories_animalId_animals_id_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drug_treatment" ADD CONSTRAINT "drug_treatment_drugId_drugs_id_fkey" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drugs" ADD CONSTRAINT "drugs_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ear_tags" ADD CONSTRAINT "ear_tags_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "farm_member_permissions" ADD CONSTRAINT "farm_member_permissions_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "farm_member_permissions" ADD CONSTRAINT "farm_member_permissions_userId_profiles_id_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" ADD CONSTRAINT "fertilizer_application_presets_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" ADD CONSTRAINT "fertilizer_application_presets_fertilizerId_fertilizers_id_fkey" FOREIGN KEY ("fertilizerId") REFERENCES "fertilizers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_fertilizerId_fertilizers_id_fkey" FOREIGN KEY ("fertilizerId") REFERENCES "fertilizers"("id");--> statement-breakpoint
ALTER TABLE "fertilizers" ADD CONSTRAINT "fertilizers_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "harvest_presets" ADD CONSTRAINT "harvest_presets_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_cropId_crops_id_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id");--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_animalId_animals_id_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_herdId_herds_id_fkey" FOREIGN KEY ("herdId") REFERENCES "herds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herds" ADD CONSTRAINT "herds_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_products_id_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contactId_contacts_id_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" ADD CONSTRAINT "outdoor_schedule_recurrences_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" ADD CONSTRAINT "outdoor_schedule_recurrences_phiXhM6XuCtO_fkey" FOREIGN KEY ("outdoor_schedule_id") REFERENCES "outdoor_shedules"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD CONSTRAINT "outdoor_shedules_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD CONSTRAINT "outdoor_shedules_herdId_herds_id_fkey" FOREIGN KEY ("herdId") REFERENCES "herds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contactId_contacts_id_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sponsorshipId_sponsorships_id_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "sponsorships"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_orders_id_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "plot_journal_entries" ADD CONSTRAINT "plot_journal_entries_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "plot_journal_entries" ADD CONSTRAINT "plot_journal_entries_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "plot_journal_entries" ADD CONSTRAINT "plot_journal_entries_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sponsorship_programs" ADD CONSTRAINT "sponsorship_programs_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_contactId_contacts_id_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_animalId_animals_id_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_sponsorshipProgramId_sponsorship_programs_id_fkey" FOREIGN KEY ("sponsorshipProgramId") REFERENCES "sponsorship_programs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_taskId_tasks_id_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_taskId_tasks_id_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_taskId_tasks_id_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_profiles_id_fkey" FOREIGN KEY ("assigneeId") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tillage_presets" ADD CONSTRAINT "tillage_presets_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tillages" ADD CONSTRAINT "tillages_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tillages" ADD CONSTRAINT "tillages_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tillages" ADD CONSTRAINT "tillages_plotId_plots_id_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_drugId_drugs_id_fkey" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "wiki_category_translations" ADD CONSTRAINT "wiki_category_translations_categoryId_wiki_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "wiki_categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wiki_entries" ADD CONSTRAINT "wiki_entries_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "wiki_entries" ADD CONSTRAINT "wiki_entries_farmId_farms_id_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wiki_entries" ADD CONSTRAINT "wiki_entries_categoryId_wiki_categories_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "wiki_categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "wiki_entry_images" ADD CONSTRAINT "wiki_entry_images_uploadedBy_profiles_id_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "wiki_entry_tags" ADD CONSTRAINT "wiki_entry_tags_entryId_wiki_entries_id_fkey" FOREIGN KEY ("entryId") REFERENCES "wiki_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wiki_entry_tags" ADD CONSTRAINT "wiki_entry_tags_tagId_wiki_tags_id_fkey" FOREIGN KEY ("tagId") REFERENCES "wiki_tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wiki_entry_translations" ADD CONSTRAINT "wiki_entry_translations_entryId_wiki_entries_id_fkey" FOREIGN KEY ("entryId") REFERENCES "wiki_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wiki_entry_translations" ADD CONSTRAINT "wiki_entry_translations_updatedBy_profiles_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "wiki_tags" ADD CONSTRAINT "wiki_tags_createdBy_profiles_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL;