import { Routing } from "express-zod-api";
import {
  createAnimalEndpoint,
  deleteAnimalEndpoint,
  getAnimalByIdEndpoint,
  getAnimalChildrenEndpoint,
  getFarmAnimalsEndpoint,
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
  syncMissingLocalIdsEndpoint,
  updatePlotEndpoint,
} from "./plots/plots.endpoint";
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
  planCropRotationsEndpoint,
} from "./crop-rotations/crop-rotations.endpoint";
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
      fieldcalendar: generateFieldCalendarReport,
    },
    animals: {
      "": {
        get: getFarmAnimalsEndpoint,
        post: createAnimalEndpoint,
      },
      batch: updateAnimalsEndpoint,
      import: importAnimalsFromExcelEndpoint,
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
  },
};
