import { DependsOnMethod, Routing } from "express-zod-api";
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
  copyFromFederalParcelsEndpoint,
  createParcelsEndpoint,
  deleteParcelEndpoint,
  getFarmParcelsEndpoint,
  getParcelByIdEndpoint,
  updateParcelEndpoint,
} from "./parcels/parcels.endpoint";
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
  createCropRotationsEndpoint,
  deleteCropRotationEndpoint,
  getCropRotationByIdEndpoint,
  getCropRotationsForFarmEndpoint,
  getCropRotationsForPlotEndpoint,
  getCropRotationYearsEndpoint,
  getCurrentCropRotationsForPlotsEndpoint,
  updateCropRotationEndpoint,
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
import { generateFieldCalendarReport } from "./reports/field-calendar-reports.endpoint";

export const routing: Routing = {
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
      "": new DependsOnMethod({
        post: createFarmEndpoint,
        get: getFarmEndpoint,
        delete: deleteFarmEndpoint,
        patch: updateFarmEndpoint,
      }),
    },

    users: {
      "": getFarmUsersEndpoint,
      byId: {
        ":userId": getUserProfileByIdEndpoint,
      },
    },
    me: {
      "": new DependsOnMethod({
        patch: updateUserProfileEndpoint,
        get: getMyUserProfileEndpoint,
      }),
    },
    harvestingMachinery: {
      "": new DependsOnMethod({
        get: getFarmHarvestingMachineryEndpoint,
        post: createHarvestingMachineryEndpoint,
      }),
      byId: {
        ":harvestingMachineryId": {
          "": new DependsOnMethod({
            get: getHarvestingMachineryByIdEndpoint,
            delete: deleteHarvestingMachineryEndpoint,
            patch: updateHarvestingMachineryEndpoint,
          }),
        },
      },
    },
    parcels: {
      "": new DependsOnMethod({
        get: getFarmParcelsEndpoint,
        post: createParcelsEndpoint,
      }),
      copy: copyFromFederalParcelsEndpoint,
      byId: {
        ":parcelId": {
          "": new DependsOnMethod({
            get: getParcelByIdEndpoint,
            delete: deleteParcelEndpoint,
            patch: updateParcelEndpoint,
          }),
        },
      },
    },
    plots: {
      "": new DependsOnMethod({
        get: getFarmPlotsEndpoint,
        post: createPlotEndpoint,
      }),
      byId: {
        ":plotId": {
          "": new DependsOnMethod({
            get: getPlotByIdEndpoint,
            delete: deletePlotEndpoint,
            patch: updatePlotEndpoint,
          }),
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
      "": new DependsOnMethod({
        get: getFarmCropsEndpoint,
        post: createCropEndpoint,
      }),
      byId: {
        ":cropId": {
          "": new DependsOnMethod({
            get: getCropByIdEndpoint,
            delete: deleteCropEndpoint,
            patch: updateCropEndpoint,
          }),
          inUse: cropInUseEndpoint,
        },
      },
    },
    cropProtectionProducts: {
      "": new DependsOnMethod({
        get: getFarmCropProtectionProductsEndpoint,
        post: createCropProtectionProductEndpoint,
      }),
      byId: {
        ":cropProtectionProductId": {
          "": new DependsOnMethod({
            get: getCropProtectionProductByIdEndpoint,
            patch: updateCropProtectionProductEndpoint,
            delete: deleteCropProtectionProductEndpoint,
          }),
          inUse: cropProtectionProductInUseEndpoint,
        },
      },
    },
    cropProtectionEquipments: {
      "": new DependsOnMethod({
        post: createCropProtectionEquipmentEndpoint,
        get: getFarmCropProtectionEquipmentsEndpoint,
      }),
      byId: {
        ":cropProtectionEquipmentId": new DependsOnMethod({
          get: getCropProtectionEquipmentByIdEndpoint,
          delete: deleteCropProtectionEquipmentEndpoint,
          patch: updateCropProtectionEquipmentEndpoint,
        }),
      },
    },
    cropProtectionApplications: {
      "": new DependsOnMethod({
        post: createCropProtectionApplicationEndpoint,
        get: getFarmCropProtectionApplicationsEndpoint,
      }),
      batch: createCropProtectionApplicationsEndpoint,
      byId: {
        ":cropProtectionApplicationId": new DependsOnMethod({
          get: getCropProtectionApplicationByIdEndpoint,
          delete: deleteCropProtectionApplicationEndpoint,
          patch: updateCropProtectionApplicationEndpoint,
        }),
      },
      summaries: getCropProtectionApplicationSummaryForFarmEndpoint,
      years: getCropProtectionApplicationYearsEndpoint,
    },
    tillageEquipments: {
      "": new DependsOnMethod({
        post: createTillageEquipmentEndpoint,
        get: getFarmTillageEquipmentsEndpoint,
      }),
      byId: {
        ":tillageEquipmentId": new DependsOnMethod({
          get: getTillageEquipmentByIdEndpoint,
          delete: deleteTillageEquipmentEndpoint,
          patch: updateTillageEquipmentEndpoint,
        }),
      },
    },
    tillages: {
      "": new DependsOnMethod({
        post: createTillageEndpoint,
        get: getFarmTillagesEndpoint,
      }),
      batch: createTillagesEndpoint,
      byId: {
        ":tillageId": new DependsOnMethod({
          get: getTillageByIdEndpoint,
          delete: deleteTillageEndpoint,
          patch: updateTillageEndpoint,
        }),
      },
      years: getTillagesYearsEndpoint,
    },
    cropRotations: {
      "": new DependsOnMethod({
        get: getCropRotationsForFarmEndpoint,
        post: createCropRotationEndpoint,
      }),
      batch: createCropRotationsEndpoint,
      current: getCurrentCropRotationsForPlotsEndpoint,
      byId: {
        ":rotationId": new DependsOnMethod({
          get: getCropRotationByIdEndpoint,
          delete: deleteCropRotationEndpoint,
          patch: updateCropRotationEndpoint,
        }),
      },
      years: getCropRotationYearsEndpoint,
    },
    harvests: {
      "": new DependsOnMethod({
        get: getHarvestsForFarmEndpoint,
      }),
      batch: createHarvestsEndpoint,
      byId: {
        ":harvestId": new DependsOnMethod({
          get: getHarvestByIdEndpoint,
          delete: deleteHarvestEndpoint,
        }),
      },
      summaries: getHarvestSummaryForFarmEndpoint,
      years: getHarvestYearsEndpoint,
    },
    fertilizerApplications: {
      "": new DependsOnMethod({
        get: getFertilizerApplicationsForFarmEndpoint,
        post: createFertilizerApplicationsEndpoint,
      }),
      byId: {
        ":fertilizerApplicationId": new DependsOnMethod({
          get: getFertilizerApplicationByIdEndpoint,
          delete: deleteFertilizerApplicationEndpoint,
        }),
      },
      summaries: getFertilizerApplicationSummaryForFarmEndpoint,
      years: getFertilizerApplicationYearsEndpoint,
    },
    fertilizers: {
      "": new DependsOnMethod({
        get: getFarmFertilizersEndpoint,
        post: createFertilizerEndpoint,
      }),
      byId: {
        ":fertilizerId": {
          "": new DependsOnMethod({
            get: getFertilizerByIdEndpoint,
            patch: updateFertilizerEndpoint,
            delete: deleteFertilizerEndpoint,
          }),
          inUse: fertilizerInUseEndpoint,
        },
      },
    },
    fertilizerSpreaders: {
      "": new DependsOnMethod({
        get: getFarmFertilizerSpreadersEndpoint,
        post: createFertilizerSpreaderEndpoint,
      }),
      byId: {
        ":fertilizerSpreaderId": new DependsOnMethod({
          get: getFertilizerSpreaderByIdEndpoint,
          patch: updateFertilizerSpreaderEndpoint,
          delete: deleteFertilizerSpreaderEndpoint,
        }),
      },
    },
    reports: {
      fieldcalendar: generateFieldCalendarReport,
    },
  },
};
