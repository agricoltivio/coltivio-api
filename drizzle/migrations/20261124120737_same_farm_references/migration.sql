-- Hand-edited: the composite keys with SET NULL only null the referencing column (farm_id is not null).
-- drizzle-kit can't express SET NULL (column), it would generate a plain SET NULL here.
ALTER TABLE "animal_heats" DROP CONSTRAINT "animal_heats_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "animal_heats" DROP CONSTRAINT "animal_heats_sire_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "animal_journal_entries" DROP CONSTRAINT "animal_journal_entries_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "animal_treatments" DROP CONSTRAINT "animal_treatments_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "animal_treatments" DROP CONSTRAINT "animal_treatments_treatment_id_treatments_id_fkey";--> statement-breakpoint
ALTER TABLE "animal_weights" DROP CONSTRAINT "animal_weights_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "animals" DROP CONSTRAINT "animals_ear_tag_id_ear_tags_id_fkey";--> statement-breakpoint
ALTER TABLE "animals" DROP CONSTRAINT "animals_herd_id_herds_id_fkey";--> statement-breakpoint
ALTER TABLE "animals" DROP CONSTRAINT "animals_mother_fk";--> statement-breakpoint
ALTER TABLE "animals" DROP CONSTRAINT "animals_father_fk";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "crop_protection_applications_plot_id_plots_id_fk";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "crop_protection_applications_product_id_crop_protection_product";--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" DROP CONSTRAINT "crop_rotation_draft_plan_entries_Jso08sQAwgs9_fkey";--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" DROP CONSTRAINT "crop_rotation_draft_plan_entries_crop_id_crops_id_fkey";--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" DROP CONSTRAINT "crop_rotation_draft_plan_plots_NNE7OVNGOmQp_fkey";--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" DROP CONSTRAINT "crop_rotation_draft_plan_plots_plot_id_plots_id_fkey";--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" DROP CONSTRAINT "crop_rotation_yearly_recurrences_8wTBnwqBsUgZ_fkey";--> statement-breakpoint
ALTER TABLE "crop_rotations" DROP CONSTRAINT "crop_rotations_plot_id_plots_id_fk";--> statement-breakpoint
ALTER TABLE "crop_rotations" DROP CONSTRAINT "crop_rotations_crop_id_crops_id_fk";--> statement-breakpoint
ALTER TABLE "crops" DROP CONSTRAINT "crops_family_id_crop_families_id_fkey";--> statement-breakpoint
ALTER TABLE "custom_outdoor_journal_categories" DROP CONSTRAINT "custom_outdoor_journal_categories_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" DROP CONSTRAINT "fertilizer_application_presets_S9oxn23jSRLF_fkey";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" DROP CONSTRAINT "fertilizer_applications_plot_id_plots_id_fk";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" DROP CONSTRAINT "fertilizer_applications_fertilizer_id_fertilizers_id_fk";--> statement-breakpoint
ALTER TABLE "harvests" DROP CONSTRAINT "forage_harvests_plot_id_plots_id_fk";--> statement-breakpoint
ALTER TABLE "harvests" DROP CONSTRAINT "forage_harvests_crop_id_crops_id_fk";--> statement-breakpoint
ALTER TABLE "herd_memberships" DROP CONSTRAINT "herd_memberships_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "herd_memberships" DROP CONSTRAINT "herd_memberships_herd_id_herds_id_fkey";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_orders_id_fkey";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fkey";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_contact_id_contacts_id_fkey";--> statement-breakpoint
ALTER TABLE "outdoor_schedule_overrides" DROP CONSTRAINT "outdoor_schedule_overrides_herd_id_herds_id_fkey";--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" DROP CONSTRAINT "outdoor_schedule_recurrences_phiXhM6XuCtO_fkey";--> statement-breakpoint
ALTER TABLE "outdoor_shedules" DROP CONSTRAINT "outdoor_shedules_herd_id_herds_id_fkey";--> statement-breakpoint
ALTER TABLE "parasite_check_animals" DROP CONSTRAINT "parasite_check_animals_check_id_parasite_checks_id_fkey";--> statement-breakpoint
ALTER TABLE "parasite_check_animals" DROP CONSTRAINT "parasite_check_animals_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "parasite_checks" DROP CONSTRAINT "parasite_checks_treatment_id_treatments_id_fkey";--> statement-breakpoint
ALTER TABLE "parasite_fec_results" DROP CONSTRAINT "parasite_fec_results_sample_id_parasite_fec_samples_id_fkey";--> statement-breakpoint
ALTER TABLE "parasite_fec_sample_animals" DROP CONSTRAINT "parasite_fec_sample_animals_CPWtsMxJK0b1_fkey";--> statement-breakpoint
ALTER TABLE "parasite_fec_sample_animals" DROP CONSTRAINT "parasite_fec_sample_animals_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "parasite_fec_samples" DROP CONSTRAINT "parasite_fec_samples_check_id_parasite_checks_id_fkey";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_contact_id_contacts_id_fkey";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_sponsorship_id_sponsorships_id_fkey";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_order_id_orders_id_fkey";--> statement-breakpoint
ALTER TABLE "plot_journal_entries" DROP CONSTRAINT "plot_journal_entries_plot_id_plots_id_fkey";--> statement-breakpoint
ALTER TABLE "seeds" DROP CONSTRAINT "seeds_crop_id_crops_id_fkey";--> statement-breakpoint
ALTER TABLE "sowing_presets" DROP CONSTRAINT "sowing_presets_crop_id_crops_id_fkey";--> statement-breakpoint
ALTER TABLE "sowing_presets" DROP CONSTRAINT "sowing_presets_seed_id_seeds_id_fkey";--> statement-breakpoint
ALTER TABLE "sowings" DROP CONSTRAINT "sowings_plot_id_plots_id_fkey";--> statement-breakpoint
ALTER TABLE "sowings" DROP CONSTRAINT "sowings_crop_id_crops_id_fkey";--> statement-breakpoint
ALTER TABLE "sowings" DROP CONSTRAINT "sowings_seed_id_seeds_id_fkey";--> statement-breakpoint
ALTER TABLE "sponsorships" DROP CONSTRAINT "sponsorships_contact_id_contacts_id_fkey";--> statement-breakpoint
ALTER TABLE "sponsorships" DROP CONSTRAINT "sponsorships_animal_id_animals_id_fkey";--> statement-breakpoint
ALTER TABLE "sponsorships" DROP CONSTRAINT "sponsorships_ndTyUkg1JW64_fkey";--> statement-breakpoint
ALTER TABLE "task_checklist_items" DROP CONSTRAINT "task_checklist_items_task_id_tasks_id_fkey";--> statement-breakpoint
ALTER TABLE "task_links" DROP CONSTRAINT "task_links_task_id_tasks_id_fkey";--> statement-breakpoint
ALTER TABLE "task_recurrences" DROP CONSTRAINT "task_recurrences_task_id_tasks_id_fkey";--> statement-breakpoint
ALTER TABLE "tillages" DROP CONSTRAINT "tillages_plot_id_plots_id_fk";--> statement-breakpoint
ALTER TABLE "treatments" DROP CONSTRAINT "treatments_drug_id_drugs_id_fkey";--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_families" ADD CONSTRAINT "crop_families_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_protection_products" ADD CONSTRAINT "crop_protection_products_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" ADD CONSTRAINT "crop_rotation_draft_plan_plots_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plans" ADD CONSTRAINT "crop_rotation_draft_plans_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "drugs" ADD CONSTRAINT "drugs_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "ear_tags" ADD CONSTRAINT "ear_tags_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "fertilizers" ADD CONSTRAINT "fertilizers_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "herds" ADD CONSTRAINT "herds_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD CONSTRAINT "outdoor_shedules_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "parasite_checks" ADD CONSTRAINT "parasite_checks_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "parasite_fec_samples" ADD CONSTRAINT "parasite_fec_samples_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "seeds" ADD CONSTRAINT "seeds_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "sponsorship_programs" ADD CONSTRAINT "sponsorship_programs_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_id_farm_id_unique" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "animal_heats" ADD CONSTRAINT "animal_heats_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_heats" ADD CONSTRAINT "animal_heats_sire_id_farm_fk" FOREIGN KEY ("sire_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE SET NULL ("sire_id");--> statement-breakpoint
ALTER TABLE "animal_journal_entries" ADD CONSTRAINT "animal_journal_entries_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_treatment_id_farm_fk" FOREIGN KEY ("treatment_id","farm_id") REFERENCES "treatments"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_weights" ADD CONSTRAINT "animal_weights_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_ear_tag_id_farm_fk" FOREIGN KEY ("ear_tag_id","farm_id") REFERENCES "ear_tags"("id","farm_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_herd_id_farm_fk" FOREIGN KEY ("herd_id","farm_id") REFERENCES "herds"("id","farm_id") ON DELETE SET NULL ("herd_id");--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_mother_id_farm_fk" FOREIGN KEY ("mother_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE SET NULL ("mother_id");--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_father_id_farm_fk" FOREIGN KEY ("father_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE SET NULL ("father_id");--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_product_id_farm_fk" FOREIGN KEY ("product_id","farm_id") REFERENCES "crop_protection_products"("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" ADD CONSTRAINT "crop_rotation_draft_plan_entries_draft_plan_plot_id_farm_fk" FOREIGN KEY ("draft_plan_plot_id","farm_id") REFERENCES "crop_rotation_draft_plan_plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_entries" ADD CONSTRAINT "crop_rotation_draft_plan_entries_crop_id_farm_fk" FOREIGN KEY ("crop_id","farm_id") REFERENCES "crops"("id","farm_id");--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" ADD CONSTRAINT "crop_rotation_draft_plan_plots_draft_plan_id_farm_fk" FOREIGN KEY ("draft_plan_id","farm_id") REFERENCES "crop_rotation_draft_plans"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_draft_plan_plots" ADD CONSTRAINT "crop_rotation_draft_plan_plots_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotation_yearly_recurrences" ADD CONSTRAINT "crop_rotation_yearly_recurrences_crop_rotation_id_farm_fk" FOREIGN KEY ("crop_rotation_id","farm_id") REFERENCES "crop_rotations"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_crop_id_farm_fk" FOREIGN KEY ("crop_id","farm_id") REFERENCES "crops"("id","farm_id");--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_family_id_farm_fk" FOREIGN KEY ("family_id","farm_id") REFERENCES "crop_families"("id","farm_id") ON DELETE SET NULL ("family_id");--> statement-breakpoint
ALTER TABLE "custom_outdoor_journal_categories" ADD CONSTRAINT "custom_outdoor_journal_categories_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_application_presets" ADD CONSTRAINT "fertilizer_application_presets_fertilizer_id_farm_fk" FOREIGN KEY ("fertilizer_id","farm_id") REFERENCES "fertilizers"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_fertilizer_id_farm_fk" FOREIGN KEY ("fertilizer_id","farm_id") REFERENCES "fertilizers"("id","farm_id");--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_crop_id_farm_fk" FOREIGN KEY ("crop_id","farm_id") REFERENCES "crops"("id","farm_id");--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_herd_id_farm_fk" FOREIGN KEY ("herd_id","farm_id") REFERENCES "herds"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_farm_fk" FOREIGN KEY ("order_id","farm_id") REFERENCES "orders"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_farm_fk" FOREIGN KEY ("product_id","farm_id") REFERENCES "products"("id","farm_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_farm_fk" FOREIGN KEY ("contact_id","farm_id") REFERENCES "contacts"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_overrides" ADD CONSTRAINT "outdoor_schedule_overrides_herd_id_farm_fk" FOREIGN KEY ("herd_id","farm_id") REFERENCES "herds"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_recurrences" ADD CONSTRAINT "outdoor_schedule_recurrences_outdoor_schedule_id_farm_fk" FOREIGN KEY ("outdoor_schedule_id","farm_id") REFERENCES "outdoor_shedules"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD CONSTRAINT "outdoor_shedules_herd_id_farm_fk" FOREIGN KEY ("herd_id","farm_id") REFERENCES "herds"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parasite_check_animals" ADD CONSTRAINT "parasite_check_animals_check_id_farm_fk" FOREIGN KEY ("check_id","farm_id") REFERENCES "parasite_checks"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parasite_check_animals" ADD CONSTRAINT "parasite_check_animals_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parasite_checks" ADD CONSTRAINT "parasite_checks_treatment_id_farm_fk" FOREIGN KEY ("treatment_id","farm_id") REFERENCES "treatments"("id","farm_id") ON DELETE SET NULL ("treatment_id");--> statement-breakpoint
ALTER TABLE "parasite_fec_results" ADD CONSTRAINT "parasite_fec_results_sample_id_farm_fk" FOREIGN KEY ("sample_id","farm_id") REFERENCES "parasite_fec_samples"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parasite_fec_sample_animals" ADD CONSTRAINT "parasite_fec_sample_animals_sample_id_farm_fk" FOREIGN KEY ("sample_id","farm_id") REFERENCES "parasite_fec_samples"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parasite_fec_sample_animals" ADD CONSTRAINT "parasite_fec_sample_animals_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "parasite_fec_samples" ADD CONSTRAINT "parasite_fec_samples_check_id_farm_fk" FOREIGN KEY ("check_id","farm_id") REFERENCES "parasite_checks"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contact_id_farm_fk" FOREIGN KEY ("contact_id","farm_id") REFERENCES "contacts"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sponsorship_id_farm_fk" FOREIGN KEY ("sponsorship_id","farm_id") REFERENCES "sponsorships"("id","farm_id") ON DELETE SET NULL ("sponsorship_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_farm_fk" FOREIGN KEY ("order_id","farm_id") REFERENCES "orders"("id","farm_id") ON DELETE SET NULL ("order_id");--> statement-breakpoint
ALTER TABLE "plot_journal_entries" ADD CONSTRAINT "plot_journal_entries_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seeds" ADD CONSTRAINT "seeds_crop_id_farm_fk" FOREIGN KEY ("crop_id","farm_id") REFERENCES "crops"("id","farm_id");--> statement-breakpoint
ALTER TABLE "sowing_presets" ADD CONSTRAINT "sowing_presets_crop_id_farm_fk" FOREIGN KEY ("crop_id","farm_id") REFERENCES "crops"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sowing_presets" ADD CONSTRAINT "sowing_presets_seed_id_farm_fk" FOREIGN KEY ("seed_id","farm_id") REFERENCES "seeds"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sowings" ADD CONSTRAINT "sowings_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sowings" ADD CONSTRAINT "sowings_crop_id_farm_fk" FOREIGN KEY ("crop_id","farm_id") REFERENCES "crops"("id","farm_id");--> statement-breakpoint
ALTER TABLE "sowings" ADD CONSTRAINT "sowings_seed_id_farm_fk" FOREIGN KEY ("seed_id","farm_id") REFERENCES "seeds"("id","farm_id");--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_contact_id_farm_fk" FOREIGN KEY ("contact_id","farm_id") REFERENCES "contacts"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_animal_id_farm_fk" FOREIGN KEY ("animal_id","farm_id") REFERENCES "animals"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_sponsorship_program_id_farm_fk" FOREIGN KEY ("sponsorship_program_id","farm_id") REFERENCES "sponsorship_programs"("id","farm_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_farm_fk" FOREIGN KEY ("task_id","farm_id") REFERENCES "tasks"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_task_id_farm_fk" FOREIGN KEY ("task_id","farm_id") REFERENCES "tasks"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_task_id_farm_fk" FOREIGN KEY ("task_id","farm_id") REFERENCES "tasks"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tillages" ADD CONSTRAINT "tillages_plot_id_farm_fk" FOREIGN KEY ("plot_id","farm_id") REFERENCES "plots"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_drug_id_farm_fk" FOREIGN KEY ("drug_id","farm_id") REFERENCES "drugs"("id","farm_id") ON DELETE RESTRICT;