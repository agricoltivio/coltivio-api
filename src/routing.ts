import { Routing } from "express-zod-api";
import {
  createAnimalEndpoint,
  deleteAnimalEndpoint,
  getAnimalByIdEndpoint,
  getAnimalChildrenEndpoint,
  getFarmAnimalsEndpoint,
  getLivingAnimalsEndpoint,
  importAnimalsFromExcelEndpoint,
  updateAnimalEndpoint,
  updateAnimalsEndpoint,
} from "./animals/animals.endpoint";
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
  getAnimalTreatmentsEndpoint,
  getFarmTreatmentsEndpoint,
  getTreatmentByIdEndpoint,
  updateTreatmentEndpoint,
} from "./treatments/treatments.endpoint";
import {
  createFarmEndpoint,
  deleteFarmEndpoint,
  getFarmEndpoint,
  updateFarmEndpoint,
} from "./farm/farm.endpoint";
import {
  createHarvestsEndpoint,
  deleteHarvestEndpoint,
  getHarvestByIdEndpoint,
  getHarvestsForFarmEndpoint,
  getHarvestsForPlotEndpoint,
  getHarvestSummaryForFarmEndpoint,
  getHarvestSummaryForPlotEndpoint,
  getHarvestYearsEndpoint,
} from "./harvests/harvests.endoint";
import {
  getFarmAndNearbyPlotsEndpoint,
  getFederalFarmIdsEndpoint,
  getPlotsLayerForBoundingBoxEndpoint,
  getPlotsForFederalFarmIdEndpoint,
  getPlotsWithinRadiusOfPointEndpoint,
} from "./layer/layer.endpoint";
import {
  getFarmUsersEndpoint,
  getMyUserProfileEndpoint,
  getUserProfileByIdEndpoint,
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
  syncMissingLocalIdsEndpoint,
  updatePlotEndpoint,
} from "./plots/plots.endpoint";
import {
  createFertilizerSpreaderEndpoint,
  deleteFertilizerSpreaderEndpoint,
  getFarmFertilizerSpreadersEndpoint,
  getFertilizerSpreaderByIdEndpoint,
  updateFertilizerSpreaderEndpoint,
} from "./equipment/fertilizer-spreaders.endpoint";
import {
  createHarvestingMachineryEndpoint,
  deleteHarvestingMachineryEndpoint,
  getFarmHarvestingMachineryEndpoint,
  getHarvestingMachineryByIdEndpoint,
  updateHarvestingMachineryEndpoint,
} from "./equipment/harvesting-machinery.endpoint";
import {
  createCropRotationEndpoint,
  createCropRotationsByCropEndpoint,
  createCropRotationsByPlotEndpoint,
  deleteCropRotationEndpoint,
  getCropRotationByIdEndpoint,
  getCropRotationsForFarmEndpoint,
  getCropRotationsForPlotEndpoint,
  getCropRotationYearsEndpoint,
  getCurrentCropRotationsForPlotsEndpoint as getCropRotationsForPlotsEndpoint,
  updateCropRotationEndpoint,
  createCropRotationsPlanEndpoint,
} from "./crop-rotations/crop-rotations.endpoint";
import {
  createTillageEquipmentEndpoint,
  deleteTillageEquipmentEndpoint,
  getFarmTillageEquipmentsEndpoint,
  getTillageEquipmentByIdEndpoint,
  updateTillageEquipmentEndpoint,
} from "./equipment/tillage-equipment.endpoint";
import {
  createTillageEndpoint,
  createTillagesEndpoint,
  deleteTillageEndpoint,
  getFarmTillagesEndpoint,
  getPlotTillagesEndpoint,
  getTillageByIdEndpoint,
  getTillagesYearsEndpoint,
  updateTillageEndpoint,
} from "./tillages/tillages.endpoint";
import {
  updateCropProtectionEquipmentEndpoint,
  createCropProtectionEquipmentEndpoint,
  deleteCropProtectionEquipmentEndpoint,
  getCropProtectionEquipmentByIdEndpoint,
  getFarmCropProtectionEquipmentsEndpoint,
} from "./equipment/crop-protection-equipment.endpoint";
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
  cancelOrderEndpoint,
  confirmOrderEndpoint,
  createOrderEndpoint,
  fulfillOrderEndpoint,
  getContactOrdersEndpoint,
  getFarmOrdersEndpoint,
  getOrderByIdEndpoint,
  getOrderItemsEndpoint,
  updateOrderEndpoint,
} from "./orders/orders.endpoint";
import {
  createProductEndpoint,
  deleteProductEndpoint,
  getActiveProductsEndpoint,
  getFarmProductsEndpoint,
  getProductByIdEndpoint,
  updateProductEndpoint,
} from "./products/products.endpoint";
import { generateFieldCalendarReport } from "./reports/field-calendar-reports.endpoint";
import { healthEndpoint } from "./chore/chore.endpoint";
import {
  createAnimalGroupEndpoint,
  deleteAnimalGroupEndpoint,
  getAnimalGroupByIdEndpoint,
  getAnimalGroupsEndpoint,
  updateAnimalGroupEndpoint,
} from "./outdoor-journal/animal-groups.endpoint";
import {
  createOutdoorJournalEntryEndpoint,
  deleteOutdoorJournalEntryEndpoint,
  getOutdoorJournalCalendarEndpoint,
  getOutdoorJournalEntriesEndpoint,
  getOutdoorJournalEntryByIdEndpoint,
  updateOutdoorJournalEntryEndpoint,
} from "./outdoor-journal/outdoor-journal.endpoint";

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
    farm: {
      "": {
        post: createFarmEndpoint,
        get: getFarmEndpoint,
        delete: deleteFarmEndpoint,
        patch: updateFarmEndpoint,
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
    harvestingMachinery: {
      "": {
        get: getFarmHarvestingMachineryEndpoint,
        post: createHarvestingMachineryEndpoint,
      },
      byId: {
        ":harvestingMachineryId": {
          "": {
            get: getHarvestingMachineryByIdEndpoint,
            delete: deleteHarvestingMachineryEndpoint,
            patch: updateHarvestingMachineryEndpoint,
          },
        },
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
          cropProtectionApplicationSummary:
            getCropProtectionApplicationSummaryForPlotEndpoint,
          fertilizerApplications: getFertilizerApplicationsForPlotEndpoint,
          fertilizerApplicationSummary:
            getFertilizerApplicationSummaryForPlotEndpoint,
          harvests: getHarvestsForPlotEndpoint,
          harvestSummary: getHarvestSummaryForPlotEndpoint,
        },
      },
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
    cropProtectionEquipments: {
      "": {
        post: createCropProtectionEquipmentEndpoint,
        get: getFarmCropProtectionEquipmentsEndpoint,
      },
      byId: {
        ":cropProtectionEquipmentId": {
          get: getCropProtectionEquipmentByIdEndpoint,
          delete: deleteCropProtectionEquipmentEndpoint,
          patch: updateCropProtectionEquipmentEndpoint,
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
    },
    tillageEquipments: {
      "": {
        post: createTillageEquipmentEndpoint,
        get: getFarmTillageEquipmentsEndpoint,
      },
      byId: {
        ":tillageEquipmentId": {
          get: getTillageEquipmentByIdEndpoint,
          delete: deleteTillageEquipmentEndpoint,
          patch: updateTillageEquipmentEndpoint,
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
    },
    cropRotations: {
      "": {
        get: getCropRotationsForFarmEndpoint,
        post: createCropRotationEndpoint,
      },
      plan: createCropRotationsPlanEndpoint,
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
    fertilizerSpreaders: {
      "": {
        get: getFarmFertilizerSpreadersEndpoint,
        post: createFertilizerSpreaderEndpoint,
      },
      byId: {
        ":fertilizerSpreaderId": {
          get: getFertilizerSpreaderByIdEndpoint,
          patch: updateFertilizerSpreaderEndpoint,
          delete: deleteFertilizerSpreaderEndpoint,
        },
      },
    },
    reports: {
      fieldcalendar: generateFieldCalendarReport,
    },
    animals: {
      "": {
        get: getFarmAnimalsEndpoint,
        post: createAnimalEndpoint,
      },
      batch: updateAnimalsEndpoint,
      import: importAnimalsFromExcelEndpoint,
      living: getLivingAnimalsEndpoint,
      byId: {
        ":animalId": {
          "": {
            get: getAnimalByIdEndpoint,
            patch: updateAnimalEndpoint,
            delete: deleteAnimalEndpoint,
          },
          children: getAnimalChildrenEndpoint,
          sponsorships: getAnimalSponsorshipsEndpoint,
          treatments: getAnimalTreatmentsEndpoint,
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
      byId: {
        ":orderId": {
          "": {
            get: getOrderByIdEndpoint,
            patch: updateOrderEndpoint,
          },
          items: getOrderItemsEndpoint,
          confirm: confirmOrderEndpoint,
          fulfill: fulfillOrderEndpoint,
          cancel: cancelOrderEndpoint,
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
    animalGroups: {
      "": {
        get: getAnimalGroupsEndpoint,
        post: createAnimalGroupEndpoint,
      },
      byId: {
        ":groupId": {
          "": {
            get: getAnimalGroupByIdEndpoint,
            patch: updateAnimalGroupEndpoint,
            delete: deleteAnimalGroupEndpoint,
          },
        },
      },
    },
    outdoorJournal: {
      "": {
        get: getOutdoorJournalEntriesEndpoint,
        post: createOutdoorJournalEntryEndpoint,
      },
      byId: {
        ":entryId": {
          "": {
            get: getOutdoorJournalEntryByIdEndpoint,
            patch: updateOutdoorJournalEntryEndpoint,
            delete: deleteOutdoorJournalEntryEndpoint,
          },
        },
      },
      calendar: getOutdoorJournalCalendarEndpoint,
    },
  },
};
