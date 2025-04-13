import { cropRotationsApi } from "../crop-rotations/crop-rotations";
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
import { parcelsApi } from "../parcels/parcels";
import { cropProtectionApplicationsApi } from "../crop-protection/crop-protection-applications";
import { plotsApi } from "../plots/plots";
import { tillagesApi } from "../tillages/tillages";
import { usersApi } from "../user/users";
import { cropProtectionProductsApi } from "../crop-protection/crop-protection-products";
import { TFunction } from "i18next";
import { fieldCalendarReportsApi } from "../reports/field-calendar-reports";

export function sessionApi(db: RlsDb, t: TFunction, locale: string) {
  return {
    parcels: parcelsApi(db),
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
  };
}
