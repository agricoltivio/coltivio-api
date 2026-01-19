CREATE TYPE "animal_type" AS ENUM('goat', 'sheep', 'cow', 'horse', 'donkey', 'pig', 'deer');--> statement-breakpoint
CREATE TYPE "death_reason" AS ENUM('died', 'slaughtered');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('pending', 'confirmed', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "payment_method" AS ENUM('cash', 'bank_transfer', 'twint', 'card', 'other');--> statement-breakpoint
CREATE TYPE "preferred_communication" AS ENUM('email', 'phone', 'whatsapp');--> statement-breakpoint
CREATE TYPE "product_category" AS ENUM('meat', 'vegetables', 'dairy', 'eggs', 'other');--> statement-breakpoint
CREATE TYPE "product_unit" AS ENUM('kg', 'g', 'piece', 'bunch', 'liter');--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "animal_type" NOT NULL,
	"date_of_birth" date NOT NULL,
	"ear_tag_id" uuid,
	"mother_id" uuid,
	"father_id" uuid,
	"date_of_death" date,
	"death_reason" "death_reason"
);
--> statement-breakpoint
ALTER TABLE "animals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"street" text,
	"city" text,
	"zip" text,
	"phone" text,
	"email" text,
	"preferred_communication" "preferred_communication",
	"labels" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ear_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"number" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ear_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" real NOT NULL,
	"unit_price" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending'::"order_status" NOT NULL,
	"order_date" date NOT NULL,
	"shipping_date" date,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"sponsorship_id" uuid,
	"order_id" uuid,
	"date" date NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"method" "payment_method" NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "product_category" NOT NULL,
	"unit" "product_unit" NOT NULL,
	"price_per_unit" real NOT NULL,
	"stock" real NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"preferred_communication" "preferred_communication"
);
--> statement-breakpoint
ALTER TABLE "sponsorships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_ear_tag_id_ear_tags_id_fkey" FOREIGN KEY ("ear_tag_id") REFERENCES "ear_tags"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_mother_fk" FOREIGN KEY ("mother_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_father_fk" FOREIGN KEY ("father_id") REFERENCES "animals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ear_tags" ADD CONSTRAINT "ear_tags_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sponsorship_id_sponsorships_id_fkey" FOREIGN KEY ("sponsorship_id") REFERENCES "sponsorships"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "only farm members" ON "animals" AS PERMISSIVE FOR ALL TO "authenticated" USING ("animals"."farm_id" = farm_id()) WITH CHECK ("animals"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "contacts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("contacts"."farm_id" = farm_id()) WITH CHECK ("contacts"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "ear_tags" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ear_tags"."farm_id" = farm_id()) WITH CHECK ("ear_tags"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "order_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("order_items"."farm_id" = farm_id()) WITH CHECK ("order_items"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "orders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("orders"."farm_id" = farm_id()) WITH CHECK ("orders"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "payments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payments"."farm_id" = farm_id()) WITH CHECK ("payments"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "products" AS PERMISSIVE FOR ALL TO "authenticated" USING ("products"."farm_id" = farm_id()) WITH CHECK ("products"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "sponsorships" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sponsorships"."farm_id" = farm_id()) WITH CHECK ("sponsorships"."farm_id" = farm_id());