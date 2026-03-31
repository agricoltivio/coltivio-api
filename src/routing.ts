import { Routing } from "express-zod-api";
import {
  createAnimalEndpoint,
  createHerdEndpoint,
  createOutdoorScheduleEndpoint,
  deleteAnimalEndpoint,
  deleteHerdEndpoint,
  deleteOutdoorScheduleEndpoint,
  getOutdoorJournalEndpoint,
  getAnimalByIdEndpoint,
  getAnimalChildrenEndpoint,
  getFarmAnimalsEndpoint,
  getFarmHerdsEndpoint,
  getHerdByIdEndpoint,
  getHerdOutdoorSchedulesEndpoint,
  getOutdoorScheduleByIdEndpoint,
  importAnimalsFromExcelEndpoint,
  previewAnimalImportEndpoint,
  commitAnimalImportEndpoint,
  updateAnimalEndpoint,
  updateHerdEndpoint,
  updateOutdoorScheduleEndpoint,
  batchUpdateAnimalsEndpoint,
  deleteAnimalsEndpoint,
  setCustomOutdoorJournalCategoriesEndpoint,
} from "./animals/animals.endpoint";
import {
  createAnimalJournalEntryEndpoint,
  deleteAnimalJournalEntryEndpoint,
  deleteAnimalJournalImageEndpoint,
  getAnimalJournalEntryEndpoint,
  listAnimalJournalEntriesEndpoint,
  registerAnimalJournalImageEndpoint,
  requestAnimalJournalImageSignedUrlEndpoint,
  updateAnimalJournalEntryEndpoint,
} from "./animals/animal-journal.endpoint";
import {
  createContactEndpoint,
  deleteContactEndpoint,
  getContactByIdEndpoint,
  getFarmContactsEndpoint,
  updateContactEndpoint,
} from "./contacts/contacts.endpoint";
import {
  createPaymentEndpoint,
  deletePaymentEndpoint,
  getContactPaymentsEndpoint,
  getFarmPaymentsEndpoint,
  getPaymentByIdEndpoint,
  updatePaymentEndpoint,
} from "./payments/payments.endpoint";
import {
  createSponsorshipEndpoint,
  deleteSponsorshipEndpoint,
  getAnimalSponsorshipsEndpoint,
  getContactSponsorshipsEndpoint,
  getFarmSponsorshipsEndpoint,
  getSponsorshipByIdEndpoint,
  // getSponsorshipPaymentsEndpoint,
  updateSponsorshipEndpoint,
} from "./sponsorships/sponsorships.endpoint";
import {
  createSponsorshipProgramEndpoint,
  deleteSponsorshipProgramEndpoint,
  getFarmSponsorshipProgramsEndpoint,
  getSponsorshipProgramByIdEndpoint,
  updateSponsorshipProgramEndpoint,
} from "./sponsorships/sponsorship-programs.endpoint";
import {
  createEarTagRangeEndpoint,
  deleteEarTagRangeEndpoint,
  getAvailableEarTagsEndpoint,
  getEarTagsEndpoint,
} from "./ear-tags/ear-tags.endpoint";
import {
  createDrugEndpoint,
  deleteDrugEndpoint,
  drugInUseEndpoint,
  getDrugByIdEndpoint,
  getFarmDrugsEndpoint,
  updateDrugEndpoint,
} from "./drugs/drugs.endpoint";
import {
  createTreatmentEndpoint,
  deleteTreatmentEndpoint,
  getFarmTreatmentsEndpoint,
  getTreatmentByIdEndpoint,
  updateTreatmentEndpoint,
} from "./treatments/treatments.endpoint";
import { createFarmEndpoint, deleteFarmEndpoint, getFarmEndpoint, updateFarmEndpoint } from "./farm/farm.endpoint";
import {
  listFarmInvitesEndpoint,
  createFarmInviteEndpoint,
  revokeFarmInviteEndpoint,
  acceptFarmInviteEndpoint,
} from "./farm/farm-invites.endpoint";
import { getDashboardStatsEndpoint, getFieldEventsEndpoint } from "./dashboard/dashboard.endpoint";
import {
  createHarvestsEndpoint,
  deleteHarvestEndpoint,
  getHarvestByIdEndpoint,
  getHarvestsForFarmEndpoint,
  getHarvestsForPlotEndpoint,
  getHarvestSummaryForFarmEndpoint,
  getHarvestSummaryForPlotEndpoint,
  getHarvestYearsEndpoint,
  getHarvestPresetsEndpoint,
  getHarvestPresetByIdEndpoint,
  createHarvestPresetEndpoint,
  updateHarvestPresetEndpoint,
  deleteHarvestPresetEndpoint,
} from "./harvests/harvests.endoint";
import {
  getFarmAndNearbyPlotsEndpoint,
  getFederalFarmIdsEndpoint,
  getPlotsLayerForBoundingBoxEndpoint,
  getPlotsForFederalFarmIdEndpoint,
  getPlotsWithinRadiusOfPointEndpoint,
} from "./layer/layer.endpoint";
import {
  changeFarmMemberRoleEndpoint,
  getFarmUsersEndpoint,
  getMyUserProfileEndpoint,
  getUserProfileByIdEndpoint,
  kickFarmMemberEndpoint,
  updateUserProfileEndpoint,
} from "./user/users.endpoint";
import {
  createFertilizerApplicationsEndpoint,
  deleteFertilizerApplicationEndpoint,
  getFertilizerApplicationByIdEndpoint,
  getFertilizerApplicationsForFarmEndpoint,
  getFertilizerApplicationsForPlotEndpoint,
  getFertilizerApplicationSummaryForFarmEndpoint,
  getFertilizerApplicationSummaryForPlotEndpoint,
  getFertilizerApplicationYearsEndpoint,
  getFertilizerApplicationPresetsEndpoint,
  getFertilizerApplicationPresetByIdEndpoint,
  createFertilizerApplicationPresetEndpoint,
  updateFertilizerApplicationPresetEndpoint,
  deleteFertilizerApplicationPresetEndpoint,
} from "./fertilization/fertilizer-applications.endpoint";
import {
  createFertilizerEndpoint,
  deleteFertilizerEndpoint,
  fertilizerInUseEndpoint,
  getFarmFertilizersEndpoint,
  getFertilizerByIdEndpoint,
  updateFertilizerEndpoint,
} from "./fertilization/fertilizers.endpoint";
import {
  createCropEndpoint,
  deleteCropEndpoint,
  getFarmCropsEndpoint,
  getCropByIdEndpoint,
  updateCropEndpoint,
  cropInUseEndpoint,
  createCropFamilyEndpoint,
  deleteCropFamilyEndpoint,
  getFarmCropFamiliesEndpoint,
  getCropFamilyByIdEndpoint,
  updateCropFamilyEndpoint,
  cropFamilyInUseEndpoint,
} from "./crops/crops.endpoint";
import {
  createPlotEndpoint,
  deletePlotEndpoint,
  getFarmPlotsEndpoint,
  getPlotByIdEndpoint,
  mergePlotsEndpoint,
  splitPlotEndpoint,
  syncMissingLocalIdsEndpoint,
  updatePlotEndpoint,
} from "./plots/plots.endpoint";
import {
  createPlotJournalEntryEndpoint,
  deletePlotJournalEntryEndpoint,
  deletePlotJournalImageEndpoint,
  getPlotJournalEntryEndpoint,
  listPlotJournalEntriesEndpoint,
  registerPlotJournalImageEndpoint,
  requestPlotJournalImageSignedUrlEndpoint,
  updatePlotJournalEntryEndpoint,
} from "./plots/plot-journal.endpoint";
import {
  createCropRotationEndpoint,
  createCropRotationsByCropEndpoint,
  createCropRotationsByPlotEndpoint,
  deleteCropRotationEndpoint,
  getCropRotationByIdEndpoint,
  getCropRotationsForFarmEndpoint,
  getCropRotationsForPlotEndpoint,
  getCropRotationYearsEndpoint,
  getCropRotationsForPlotsEndpoint,
  updateCropRotationEndpoint,
  planCropRotationsEndpoint,
} from "./crop-rotations/crop-rotations.endpoint";
import {
  applyDraftPlanEndpoint,
  createDraftPlanEndpoint,
  deleteDraftPlanEndpoint,
  getDraftPlanByIdEndpoint,
  listDraftPlansEndpoint,
  updateDraftPlanEndpoint,
} from "./crop-rotations/crop-rotation-draft-plans.endpoint";
import {
  createTillageEndpoint,
  createTillagesEndpoint,
  deleteTillageEndpoint,
  getFarmTillagesEndpoint,
  getPlotTillagesEndpoint,
  getTillageByIdEndpoint,
  getTillagesYearsEndpoint,
  updateTillageEndpoint,
  getTillagePresetsEndpoint,
  getTillagePresetByIdEndpoint,
  createTillagePresetEndpoint,
  updateTillagePresetEndpoint,
  deleteTillagePresetEndpoint,
} from "./tillages/tillages.endpoint";
import {
  createCropProtectionApplicationEndpoint,
  createCropProtectionApplicationsEndpoint,
  deleteCropProtectionApplicationEndpoint,
  getCropProtectionApplicationByIdEndpoint,
  getCropProtectionApplicationSummaryForFarmEndpoint,
  getCropProtectionApplicationSummaryForPlotEndpoint,
  getCropProtectionApplicationYearsEndpoint,
  getFarmCropProtectionApplicationsEndpoint,
  getPlotCropProtectionApplicationsEndpoint,
  updateCropProtectionApplicationEndpoint,
  getCropProtectionApplicationPresetsEndpoint,
  getCropProtectionApplicationPresetByIdEndpoint,
  createCropProtectionApplicationPresetEndpoint,
  updateCropProtectionApplicationPresetEndpoint,
  deleteCropProtectionApplicationPresetEndpoint,
} from "./crop-protection/crop-protection-applications.endpoint";
import {
  createCropProtectionProductEndpoint,
  cropProtectionProductInUseEndpoint,
  deleteCropProtectionProductEndpoint,
  getCropProtectionProductByIdEndpoint,
  getFarmCropProtectionProductsEndpoint,
  updateCropProtectionProductEndpoint,
} from "./crop-protection/crop-protection-products.endpoint";
import {
  addOrderItemEndpoint,
  cancelOrderEndpoint,
  confirmOrderEndpoint,
  createOrderEndpoint,
  fulfillOrderEndpoint,
  getContactOrdersEndpoint,
  getFarmOrdersEndpoint,
  getOrderByIdEndpoint,
  getOrderItemsEndpoint,
  removeOrderItemEndpoint,
  updateOrderEndpoint,
  updateOrderItemEndpoint,
} from "./orders/orders.endpoint";
import {
  getInvoiceSettingsEndpoint,
  createInvoiceSettingsEndpoint,
  updateInvoiceSettingsEndpoint,
  deleteInvoiceSettingsEndpoint,
  uploadLogoEndpoint,
  deleteLogoEndpoint,
} from "./orders/invoice-settings.endpoint";
import { downloadInvoiceEndpoint, downloadInvoicesBatchEndpoint } from "./orders/invoice.endpoint";
import {
  createProductEndpoint,
  deleteProductEndpoint,
  getActiveProductsEndpoint,
  getFarmProductsEndpoint,
  getProductByIdEndpoint,
  updateProductEndpoint,
} from "./products/products.endpoint";
import { sendFieldCalendarReport, downloadFieldCalendarReport } from "./reports/field-calendar-reports.endpoint";
import { downloadTreatmentReport } from "./reports/treatment-reports.endpoint";
import { downloadOutdoorJournalReport } from "./reports/outdoor-journal-reports.endpoint";
import { healthEndpoint } from "./chore/chore.endpoint";
import { verifyCaptchaEndpoint } from "./captcha/turnstile.endpoint";
import {
  listPublishedWikiEntriesEndpoint,
  getMyWikiEntriesEndpoint,
  createWikiEntryEndpoint,
  updateWikiEntryEndpoint,
  deleteWikiEntryEndpoint,
  submitWikiEntryEndpoint,
  createWikiChangeRequestEndpoint,
  requestWikiImageSignedUrlEndpoint,
  registerWikiImageEndpoint,
  deleteWikiImageEndpoint,
  listWikiTagsEndpoint,
  upsertWikiTagEndpoint,
  getMyWikiChangeRequestsEndpoint,
  listWikiCategoriesEndpoint,
  updateWikiChangeRequestDraftEndpoint,
  submitWikiChangeRequestDraftEndpoint,
  addWikiChangeRequestNoteEndpoint,
  getWikiChangeRequestNotesEndpoint,
  getWikiEntryByIdEndpoint,
} from "./wiki/wiki.endpoint";
import {
  createTaskEndpoint,
  deleteTaskEndpoint,
  getTaskByIdEndpoint,
  listTasksEndpoint,
  setChecklistItemDoneEndpoint,
  setTaskStatusEndpoint,
  updateTaskEndpoint,
} from "./tasks/tasks.endpoint";
import {
  getWikiReviewQueueEndpoint,
  getWikiChangeRequestForReviewEndpoint,
  approveWikiChangeRequestEndpoint,
  rejectWikiChangeRequestEndpoint,
  requestWikiChangesEndpoint,
  createWikiCategoryEndpoint,
  deleteWikiCategoryEndpoint,
} from "./wiki/wiki-moderation.endpoint";
import {
  createSubscriptionCheckoutEndpoint,
  createManualCheckoutEndpoint,
  getMembershipStatusEndpoint,
  cancelMembershipEndpoint,
  getMembershipPaymentsEndpoint,
  createPaymentMethodSetupEndpoint,
  reactivateMembershipEndpoint,
  startTrialEndpoint,
} from "./membership/membership.endpoint";
import { createDonationCheckoutEndpoint } from "./donations/donations.endpoint";
import {
  listForumThreadsEndpoint,
  createForumThreadEndpoint,
  getForumThreadByIdEndpoint,
  updateForumThreadEndpoint,
  deleteForumThreadEndpoint,
  listForumRepliesEndpoint,
  addForumReplyEndpoint,
  updateForumReplyEndpoint,
  deleteForumReplyEndpoint,
} from "./forum/forum.endpoint";
import { setForumThreadStatusEndpoint, pinForumThreadEndpoint } from "./forum/forum-moderation.endpoint";
import { createHandoffTokenEndpoint, exchangeHandoffTokenEndpoint } from "./auth/handoff.endpoint";

export const routing: Routing = {
  healthz: healthEndpoint,
  v1: {
    layers: {
      plots: {
        bbox: getPlotsLayerForBoundingBoxEndpoint,
        farms: {
          ":federalFarmId": {
            only: getPlotsForFederalFarmIdEndpoint,
            bbox: getFarmAndNearbyPlotsEndpoint,
          },
        },
        radius: getPlotsWithinRadiusOfPointEndpoint,
      },
      federalFarmIds: getFederalFarmIdsEndpoint,
    },
    captcha: {
      verify: verifyCaptchaEndpoint,
    },
    farm: {
      "": {
        post: createFarmEndpoint,
        get: getFarmEndpoint,
        delete: deleteFarmEndpoint,
        patch: updateFarmEndpoint,
      },
      dashboard: getDashboardStatsEndpoint,
      fieldEvents: getFieldEventsEndpoint,
      invites: {
        "": { get: listFarmInvitesEndpoint, post: createFarmInviteEndpoint },
        accept: { post: acceptFarmInviteEndpoint },
        byId: {
          ":inviteId": { delete: revokeFarmInviteEndpoint },
        },
      },
      members: {
        byId: {
          ":userId": {
            "": { delete: kickFarmMemberEndpoint },
            role: { patch: changeFarmMemberRoleEndpoint },
          },
        },
      },
    },

    users: {
      "": getFarmUsersEndpoint,
      byId: {
        ":userId": getUserProfileByIdEndpoint,
      },
    },
    me: {
      "": {
        patch: updateUserProfileEndpoint,
        get: getMyUserProfileEndpoint,
      },
    },
    // parcels: {
    //   "": {
    //     get: getFarmParcelsEndpoint,
    //     post: createParcelsEndpoint,
    //   }),
    //   copy: copyFromFederalParcelsEndpoint,
    //   byId: {
    //     ":parcelId": {
    //       "": {
    //         get: getParcelByIdEndpoint,
    //         delete: deleteParcelEndpoint,
    //         patch: updateParcelEndpoint,
    //       }),
    //     },
    //   },
    // },
    plots: {
      "": {
        get: getFarmPlotsEndpoint,
        post: createPlotEndpoint,
      },
      byId: {
        ":plotId": {
          "": {
            get: getPlotByIdEndpoint,
            delete: deletePlotEndpoint,
            patch: updatePlotEndpoint,
          },
          cropRotations: getCropRotationsForPlotEndpoint,
          tillages: getPlotTillagesEndpoint,
          cropProtectionApplications: getPlotCropProtectionApplicationsEndpoint,
          cropProtectionApplicationSummary: getCropProtectionApplicationSummaryForPlotEndpoint,
          fertilizerApplications: getFertilizerApplicationsForPlotEndpoint,
          fertilizerApplicationSummary: getFertilizerApplicationSummaryForPlotEndpoint,
          harvests: getHarvestsForPlotEndpoint,
          harvestSummary: getHarvestSummaryForPlotEndpoint,
          split: splitPlotEndpoint,
          journal: { "": { get: listPlotJournalEntriesEndpoint, post: createPlotJournalEntryEndpoint } },
        },
      },
      journal: {
        byId: {
          ":entryId": {
            "": {
              get: getPlotJournalEntryEndpoint,
              patch: updatePlotJournalEntryEndpoint,
              delete: deletePlotJournalEntryEndpoint,
            },
          },
        },
        images: {
          signedUrl: { post: requestPlotJournalImageSignedUrlEndpoint },
          "": { post: registerPlotJournalImageEndpoint },
          byId: { ":imageId": { delete: deletePlotJournalImageEndpoint } },
        },
      },
      merge: mergePlotsEndpoint,
      syncMissingLocalIds: syncMissingLocalIdsEndpoint,
    },
    crops: {
      "": {
        get: getFarmCropsEndpoint,
        post: createCropEndpoint,
      },
      byId: {
        ":cropId": {
          "": {
            get: getCropByIdEndpoint,
            delete: deleteCropEndpoint,
            patch: updateCropEndpoint,
          },
          inUse: cropInUseEndpoint,
        },
      },
      families: {
        "": {
          get: getFarmCropFamiliesEndpoint,
          post: createCropFamilyEndpoint,
        },
        byId: {
          ":familyId": {
            "": {
              get: getCropFamilyByIdEndpoint,
              delete: deleteCropFamilyEndpoint,
              patch: updateCropFamilyEndpoint,
            },
            inUse: cropFamilyInUseEndpoint,
          },
        },
      },
    },
    cropProtectionProducts: {
      "": {
        get: getFarmCropProtectionProductsEndpoint,
        post: createCropProtectionProductEndpoint,
      },
      byId: {
        ":cropProtectionProductId": {
          "": {
            get: getCropProtectionProductByIdEndpoint,
            patch: updateCropProtectionProductEndpoint,
            delete: deleteCropProtectionProductEndpoint,
          },
          inUse: cropProtectionProductInUseEndpoint,
        },
      },
    },
    cropProtectionApplications: {
      "": {
        post: createCropProtectionApplicationEndpoint,
        get: getFarmCropProtectionApplicationsEndpoint,
      },
      batch: createCropProtectionApplicationsEndpoint,
      byId: {
        ":cropProtectionApplicationId": {
          get: getCropProtectionApplicationByIdEndpoint,
          delete: deleteCropProtectionApplicationEndpoint,
          patch: updateCropProtectionApplicationEndpoint,
        },
      },
      summaries: getCropProtectionApplicationSummaryForFarmEndpoint,
      years: getCropProtectionApplicationYearsEndpoint,
      presets: {
        "": {
          get: getCropProtectionApplicationPresetsEndpoint,
          post: createCropProtectionApplicationPresetEndpoint,
        },
        byId: {
          ":presetId": {
            get: getCropProtectionApplicationPresetByIdEndpoint,
            patch: updateCropProtectionApplicationPresetEndpoint,
            delete: deleteCropProtectionApplicationPresetEndpoint,
          },
        },
      },
    },
    tillages: {
      "": {
        post: createTillageEndpoint,
        get: getFarmTillagesEndpoint,
      },
      batch: createTillagesEndpoint,
      byId: {
        ":tillageId": {
          get: getTillageByIdEndpoint,
          delete: deleteTillageEndpoint,
          patch: updateTillageEndpoint,
        },
      },
      years: getTillagesYearsEndpoint,
      presets: {
        "": {
          get: getTillagePresetsEndpoint,
          post: createTillagePresetEndpoint,
        },
        byId: {
          ":presetId": {
            get: getTillagePresetByIdEndpoint,
            patch: updateTillagePresetEndpoint,
            delete: deleteTillagePresetEndpoint,
          },
        },
      },
    },
    cropRotations: {
      "": {
        get: getCropRotationsForFarmEndpoint,
        post: createCropRotationEndpoint,
      },
      plan: planCropRotationsEndpoint,
      batch: {
        byCrop: createCropRotationsByCropEndpoint,
        byPlot: createCropRotationsByPlotEndpoint,
      },
      plots: getCropRotationsForPlotsEndpoint,
      byId: {
        ":rotationId": {
          get: getCropRotationByIdEndpoint,
          delete: deleteCropRotationEndpoint,
          patch: updateCropRotationEndpoint,
        },
      },
      years: getCropRotationYearsEndpoint,
      draftPlans: {
        "": {
          get: listDraftPlansEndpoint,
          post: createDraftPlanEndpoint,
        },
        byId: {
          ":draftPlanId": {
            "": {
              get: getDraftPlanByIdEndpoint,
              patch: updateDraftPlanEndpoint,
              delete: deleteDraftPlanEndpoint,
            },
            apply: { post: applyDraftPlanEndpoint },
          },
        },
      },
    },
    harvests: {
      "": {
        get: getHarvestsForFarmEndpoint,
      },
      batch: createHarvestsEndpoint,
      byId: {
        ":harvestId": {
          get: getHarvestByIdEndpoint,
          delete: deleteHarvestEndpoint,
        },
      },
      summaries: getHarvestSummaryForFarmEndpoint,
      years: getHarvestYearsEndpoint,
      presets: {
        "": {
          get: getHarvestPresetsEndpoint,
          post: createHarvestPresetEndpoint,
        },
        byId: {
          ":presetId": {
            get: getHarvestPresetByIdEndpoint,
            patch: updateHarvestPresetEndpoint,
            delete: deleteHarvestPresetEndpoint,
          },
        },
      },
    },
    fertilizerApplications: {
      "": {
        get: getFertilizerApplicationsForFarmEndpoint,
        post: createFertilizerApplicationsEndpoint,
      },
      byId: {
        ":fertilizerApplicationId": {
          get: getFertilizerApplicationByIdEndpoint,
          delete: deleteFertilizerApplicationEndpoint,
        },
      },
      summaries: getFertilizerApplicationSummaryForFarmEndpoint,
      years: getFertilizerApplicationYearsEndpoint,
      presets: {
        "": {
          get: getFertilizerApplicationPresetsEndpoint,
          post: createFertilizerApplicationPresetEndpoint,
        },
        byId: {
          ":presetId": {
            get: getFertilizerApplicationPresetByIdEndpoint,
            patch: updateFertilizerApplicationPresetEndpoint,
            delete: deleteFertilizerApplicationPresetEndpoint,
          },
        },
      },
    },
    fertilizers: {
      "": {
        get: getFarmFertilizersEndpoint,
        post: createFertilizerEndpoint,
      },
      byId: {
        ":fertilizerId": {
          "": {
            get: getFertilizerByIdEndpoint,
            patch: updateFertilizerEndpoint,
            delete: deleteFertilizerEndpoint,
          },
          inUse: fertilizerInUseEndpoint,
        },
      },
    },
    reports: {
      fieldcalendar: {
        email: sendFieldCalendarReport,
        download: downloadFieldCalendarReport,
      },
      treatments: {
        download: downloadTreatmentReport,
      },
      outdoorjournal: {
        download: downloadOutdoorJournalReport,
      },
    },
    animals: {
      "": {
        get: getFarmAnimalsEndpoint,
        post: createAnimalEndpoint,
        delete: deleteAnimalsEndpoint,
      },
      batch: batchUpdateAnimalsEndpoint,
      import: {
        "": importAnimalsFromExcelEndpoint,
        preview: previewAnimalImportEndpoint,
        commit: commitAnimalImportEndpoint,
      },
      byId: {
        ":animalId": {
          "": {
            get: getAnimalByIdEndpoint,
            patch: updateAnimalEndpoint,
            delete: deleteAnimalEndpoint,
          },
          children: getAnimalChildrenEndpoint,
          sponsorships: getAnimalSponsorshipsEndpoint,
          customOutdoorJournalCategories: setCustomOutdoorJournalCategoriesEndpoint,
          journal: { "": { get: listAnimalJournalEntriesEndpoint, post: createAnimalJournalEntryEndpoint } },
        },
      },
      journal: {
        byId: {
          ":entryId": {
            "": {
              get: getAnimalJournalEntryEndpoint,
              patch: updateAnimalJournalEntryEndpoint,
              delete: deleteAnimalJournalEntryEndpoint,
            },
          },
        },
        images: {
          signedUrl: { post: requestAnimalJournalImageSignedUrlEndpoint },
          "": { post: registerAnimalJournalImageEndpoint },
          byId: { ":imageId": { delete: deleteAnimalJournalImageEndpoint } },
        },
      },
      outdoorJournal: getOutdoorJournalEndpoint,
      herds: {
        "": { get: getFarmHerdsEndpoint, post: createHerdEndpoint },
        byId: {
          ":herdId": {
            "": {
              get: getHerdByIdEndpoint,
              patch: updateHerdEndpoint,
              delete: deleteHerdEndpoint,
            },
            outdoorSchedules: {
              "": {
                get: getHerdOutdoorSchedulesEndpoint,
                post: createOutdoorScheduleEndpoint,
              },
            },
          },
        },
        outdoorSchedules: {
          byId: {
            ":outdoorScheduleId": {
              get: getOutdoorScheduleByIdEndpoint,
              patch: updateOutdoorScheduleEndpoint,
              delete: deleteOutdoorScheduleEndpoint,
            },
          },
        },
      },
    },
    earTags: {
      "": getEarTagsEndpoint,
      available: getAvailableEarTagsEndpoint,
      range: {
        "": {
          post: createEarTagRangeEndpoint,
          delete: deleteEarTagRangeEndpoint,
        },
      },
    },
    drugs: {
      "": {
        get: getFarmDrugsEndpoint,
        post: createDrugEndpoint,
      },
      byId: {
        ":drugId": {
          "": {
            get: getDrugByIdEndpoint,
            patch: updateDrugEndpoint,
            delete: deleteDrugEndpoint,
          },
          inUse: drugInUseEndpoint,
        },
      },
    },
    treatments: {
      "": {
        get: getFarmTreatmentsEndpoint,
        post: createTreatmentEndpoint,
      },
      byId: {
        ":treatmentId": {
          get: getTreatmentByIdEndpoint,
          patch: updateTreatmentEndpoint,
          delete: deleteTreatmentEndpoint,
        },
      },
    },
    contacts: {
      "": {
        get: getFarmContactsEndpoint,
        post: createContactEndpoint,
      },
      byId: {
        ":contactId": {
          "": {
            get: getContactByIdEndpoint,
            patch: updateContactEndpoint,
            delete: deleteContactEndpoint,
          },
          payments: getContactPaymentsEndpoint,
          sponsorships: getContactSponsorshipsEndpoint,
          orders: getContactOrdersEndpoint,
        },
      },
    },
    products: {
      "": {
        get: getFarmProductsEndpoint,
        post: createProductEndpoint,
      },
      active: getActiveProductsEndpoint,
      byId: {
        ":productId": {
          "": {
            get: getProductByIdEndpoint,
            patch: updateProductEndpoint,
            delete: deleteProductEndpoint,
          },
        },
      },
    },
    orders: {
      "": {
        get: getFarmOrdersEndpoint,
        post: createOrderEndpoint,
      },
      invoiceSettings: {
        "": { get: getInvoiceSettingsEndpoint, post: createInvoiceSettingsEndpoint },
        ":id": {
          "": { put: updateInvoiceSettingsEndpoint, delete: deleteInvoiceSettingsEndpoint },
          logo: { put: uploadLogoEndpoint, delete: deleteLogoEndpoint },
        },
      },
      invoices: { post: downloadInvoicesBatchEndpoint },
      byId: {
        ":orderId": {
          "": {
            get: getOrderByIdEndpoint,
            patch: updateOrderEndpoint,
          },
          items: {
            "": {
              get: getOrderItemsEndpoint,
              post: addOrderItemEndpoint,
            },
            byId: {
              ":orderItemId": {
                patch: updateOrderItemEndpoint,
                delete: removeOrderItemEndpoint,
              },
            },
          },
          confirm: confirmOrderEndpoint,
          fulfill: fulfillOrderEndpoint,
          cancel: cancelOrderEndpoint,
          invoice: { post: downloadInvoiceEndpoint },
        },
      },
    },
    payments: {
      "": {
        get: getFarmPaymentsEndpoint,
        post: createPaymentEndpoint,
      },
      byId: {
        ":paymentId": {
          get: getPaymentByIdEndpoint,
          patch: updatePaymentEndpoint,
          delete: deletePaymentEndpoint,
        },
      },
    },
    sponsorshipPrograms: {
      "": {
        get: getFarmSponsorshipProgramsEndpoint,
        post: createSponsorshipProgramEndpoint,
      },
      byId: {
        ":sponsorshipProgramId": {
          "": {
            get: getSponsorshipProgramByIdEndpoint,
            patch: updateSponsorshipProgramEndpoint,
            delete: deleteSponsorshipProgramEndpoint,
          },
        },
      },
    },
    sponsorships: {
      "": {
        get: getFarmSponsorshipsEndpoint,
        post: createSponsorshipEndpoint,
      },
      byId: {
        ":sponsorshipId": {
          "": {
            get: getSponsorshipByIdEndpoint,
            patch: updateSponsorshipEndpoint,
            delete: deleteSponsorshipEndpoint,
          },
        },
      },
    },
    wiki: {
      "": {
        get: listPublishedWikiEntriesEndpoint,
        post: createWikiEntryEndpoint,
      },
      myEntries: getMyWikiEntriesEndpoint,
      myChangeRequests: getMyWikiChangeRequestsEndpoint,
      myChangeRequestDrafts: {
        byId: {
          ":changeRequestId": {
            "": updateWikiChangeRequestDraftEndpoint,
            submit: submitWikiChangeRequestDraftEndpoint,
            notes: {
              "": {
                get: getWikiChangeRequestNotesEndpoint,
                post: addWikiChangeRequestNoteEndpoint,
              },
            },
          },
        },
      },
      byId: {
        ":entryId": {
          "": {
            get: getWikiEntryByIdEndpoint,
            patch: updateWikiEntryEndpoint,
            delete: deleteWikiEntryEndpoint,
          },
          submit: submitWikiEntryEndpoint,
          changeRequest: createWikiChangeRequestEndpoint,
        },
      },
      images: {
        signedUrl: requestWikiImageSignedUrlEndpoint,
        "": registerWikiImageEndpoint,
        byId: {
          ":imageId": deleteWikiImageEndpoint,
        },
      },
      categories: listWikiCategoriesEndpoint,
      tags: {
        "": {
          get: listWikiTagsEndpoint,
          post: upsertWikiTagEndpoint,
        },
      },
      reviewQueue: getWikiReviewQueueEndpoint,
      changeRequests: {
        byId: {
          ":changeRequestId": {
            "": getWikiChangeRequestForReviewEndpoint,
            approve: approveWikiChangeRequestEndpoint,
            reject: rejectWikiChangeRequestEndpoint,
            requestChanges: requestWikiChangesEndpoint,
            notes: {
              "": {
                get: getWikiChangeRequestNotesEndpoint,
                post: addWikiChangeRequestNoteEndpoint,
              },
            },
          },
        },
      },
      admin: {
        categories: {
          "": createWikiCategoryEndpoint,
          byId: {
            ":categoryId": deleteWikiCategoryEndpoint,
          },
        },
      },
    },
    tasks: {
      "": { get: listTasksEndpoint, post: createTaskEndpoint },
      byId: {
        ":taskId": {
          "": {
            get: getTaskByIdEndpoint,
            patch: updateTaskEndpoint,
            delete: deleteTaskEndpoint,
          },
          status: { patch: setTaskStatusEndpoint },
          checklistItems: {
            byId: {
              ":itemId": { patch: setChecklistItemDoneEndpoint },
            },
          },
        },
      },
    },
    membership: {
      checkout: {
        subscription: { post: createSubscriptionCheckoutEndpoint },
        manual: { post: createManualCheckoutEndpoint },
      },
      status: { get: getMembershipStatusEndpoint },
      paymentMethod: { post: createPaymentMethodSetupEndpoint },
      subscription: {
        delete: cancelMembershipEndpoint,
        post: reactivateMembershipEndpoint,
      },
      payments: { get: getMembershipPaymentsEndpoint },
      trial: { post: startTrialEndpoint },
    },
    donations: {
      checkout: { post: createDonationCheckoutEndpoint },
    },
    auth: {
      handoff: { post: createHandoffTokenEndpoint },
      exchange: { post: exchangeHandoffTokenEndpoint },
    },
    forum: {
      threads: {
        "": {
          get: listForumThreadsEndpoint,
          post: createForumThreadEndpoint,
        },
        byId: {
          ":threadId": {
            "": {
              get: getForumThreadByIdEndpoint,
              patch: updateForumThreadEndpoint,
              delete: deleteForumThreadEndpoint,
            },
            replies: {
              "": {
                get: listForumRepliesEndpoint,
                post: addForumReplyEndpoint,
              },
            },
            status: { post: setForumThreadStatusEndpoint },
            pin: { post: pinForumThreadEndpoint },
          },
        },
      },
      replies: {
        byId: {
          ":replyId": {
            patch: updateForumReplyEndpoint,
            delete: deleteForumReplyEndpoint,
          },
        },
      },
    },
  },
};
