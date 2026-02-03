ALTER TABLE "crop_rotations" ALTER COLUMN "to_date" SET DEFAULT '4999-12-31';--> statement-breakpoint

UPDATE "crop_rotations"
SET "to_date" = '4999-12-31'
WHERE "to_date" IS NULL;

ALTER TABLE "crop_rotations" ALTER COLUMN "to_date" SET NOT NULL;