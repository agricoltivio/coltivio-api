import { animalsApi } from "../animals/animals";
import { contactsApi } from "../contacts/contacts";
import { cropRotationsApi } from "../crop-rotations/crop-rotations";
import { drugsApi } from "../drugs/drugs";
import { earTagsApi } from "../ear-tags/ear-tags";
import { treatmentsApi } from "../treatments/treatments";
import { ordersApi } from "../orders/orders";
import { paymentsApi } from "../payments/payments";
import { productsApi } from "../products/products";
import { sponsorshipProgramsApi } from "../sponsorships/sponsorship-programs";
import { sponsorshipsApi } from "../sponsorships/sponsorships";
import { cropApi } from "../crops/crops";
import { RlsDb } from "../db/db";
import { cropProtectionEquipmentApi } from "../equipment/crop-protection-equipment";
import { fertilizerSpreaderApi } from "../equipment/fertilizer-spreaders";
import { harvestingMachineryApi } from "../equipment/harvesting-machinery";
import { tillageEquipmentApi } from "../equipment/tillage-equipment";
import { farmsApi } from "../farm/farms";
import { fertilizerApplicationsApi } from "../fertilization/fertilizer-applications";
import { fertilizersApi } from "../fertilization/fertilizers";
import { harvestsApi } from "../harvests/harvests";
import { federalPlotsLayerApi } from "../layer/federal-farm-plots";
import { cropProtectionApplicationsApi } from "../crop-protection/crop-protection-applications";
import { plotsApi } from "../plots/plots";
import { tillagesApi } from "../tillages/tillages";
import { usersApi } from "../user/users";
import { cropProtectionProductsApi } from "../crop-protection/crop-protection-products";
import { TFunction } from "i18next";
import { fieldCalendarReportsApi } from "../reports/field-calendar-reports";
import { animalGroupsApi } from "../outdoor-journal/animal-groups";
import { outdoorJournalApi } from "../outdoor-journal/outdoor-journal";

export function sessionApi(db: RlsDb, t: TFunction, locale: string) {
  return {
    plots: plotsApi(db),
    users: usersApi(db),
    farms: farmsApi(db, t),
    federalParcelLayer: federalPlotsLayerApi(db),
    crops: cropApi(db),
    cropRotations: cropRotationsApi(db),
    harvestingMachinery: harvestingMachineryApi(db),
    harvests: harvestsApi(db),
    fertilizerApplications: fertilizerApplicationsApi(db),
    fertilizers: fertilizersApi(db),
    fertilizerSpreader: fertilizerSpreaderApi(db),
    tillages: tillagesApi(db),
    tillageEquipments: tillageEquipmentApi(db),
    cropProtectionProducts: cropProtectionProductsApi(db),
    cropProtectionEquipment: cropProtectionEquipmentApi(db),
    cropProtectionApplications: cropProtectionApplicationsApi(db),
    fieldCalendarReports: fieldCalendarReportsApi(db, t, locale),
    animals: animalsApi(db),
    earTags: earTagsApi(db),
    drugs: drugsApi(db),
    treatments: treatmentsApi(db),
    contacts: contactsApi(db),
    products: productsApi(db),
    orders: ordersApi(db),
    payments: paymentsApi(db),
    sponsorshipPrograms: sponsorshipProgramsApi(db),
    sponsorships: sponsorshipsApi(db),
    animalGroups: animalGroupsApi(db),
    outdoorJournal: outdoorJournalApi(db),
  };
}
