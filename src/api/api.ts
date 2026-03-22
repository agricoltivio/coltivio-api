import { animalsApi } from "../animals/animals";
import { dashboardApi } from "../dashboard/dashboard";
import { contactsApi } from "../contacts/contacts";
import { cropRotationsApi } from "../crop-rotations/crop-rotations";
import { drugsApi } from "../drugs/drugs";
import { earTagsApi } from "../ear-tags/ear-tags";
import { treatmentsApi } from "../treatments/treatments";
import { ordersApi } from "../orders/orders";
import { invoiceSettingsApi } from "../orders/invoice-settings";
import { paymentsApi } from "../payments/payments";
import { productsApi } from "../products/products";
import { sponsorshipProgramsApi } from "../sponsorships/sponsorship-programs";
import { sponsorshipsApi } from "../sponsorships/sponsorships";
import { cropApi } from "../crops/crops";
import { RlsDb } from "../db/db";
import { farmsApi } from "../farm/farms";
import { farmInvitesApi } from "../farm/farm-invites";
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
import { treatmentReportsApi } from "../reports/treatment-reports";
import { outdoorJournalReportsApi } from "../reports/outdoor-journal-reports";
import { wikiApi } from "../wiki/wiki";
import { wikiModerationApi } from "../wiki/wiki-moderation";
import { forumApi } from "../forum/forum";
import { forumModerationApi } from "../forum/forum-moderation";
import { tasksApi } from "../tasks/tasks";
import { membershipApi } from "../membership/membership";
import { donationsApi } from "../donations/donations";
import { handoffApi } from "../auth/handoff";

export function sessionApi(db: RlsDb, t: TFunction, locale: string) {
  return {
    plots: plotsApi(db),
    dashboard: dashboardApi(db, t),
    users: usersApi(db),
    farms: farmsApi(db, t),
    farmInvites: farmInvitesApi(db, t),
    federalParcelLayer: federalPlotsLayerApi(db),
    crops: cropApi(db),
    cropRotations: cropRotationsApi(db),
    harvests: harvestsApi(db),
    fertilizerApplications: fertilizerApplicationsApi(db),
    fertilizers: fertilizersApi(db),
    tillages: tillagesApi(db),
    cropProtectionProducts: cropProtectionProductsApi(db),
    cropProtectionApplications: cropProtectionApplicationsApi(db),
    fieldCalendarReports: fieldCalendarReportsApi(db, t, locale),
    treatmentReports: treatmentReportsApi(db, t, locale),
    outdoorJournalReports: outdoorJournalReportsApi(db, t, locale),
    animals: animalsApi(db),
    earTags: earTagsApi(db),
    drugs: drugsApi(db),
    treatments: treatmentsApi(db),
    contacts: contactsApi(db),
    products: productsApi(db),
    orders: ordersApi(db),
    invoiceSettings: invoiceSettingsApi(db),
    payments: paymentsApi(db),
    sponsorshipPrograms: sponsorshipProgramsApi(db),
    sponsorships: sponsorshipsApi(db),
    wiki: wikiApi(db),
    wikiModeration: wikiModerationApi(db),
    forum: forumApi(db),
    forumModeration: forumModerationApi(db),
    tasks: tasksApi(db, locale),
    membership: membershipApi(db),
    donations: donationsApi(db),
    handoff: handoffApi(db),
  };
}
