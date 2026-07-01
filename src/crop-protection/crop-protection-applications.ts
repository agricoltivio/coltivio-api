import { eq, sql } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { cropProtectionApplications, cropProtectionUnitSchema, cropProtectionApplicationPresets } from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { Plot } from "../plots/plots";
import { CropProtectionProduct } from "./crop-protection-products";
import { z } from "zod";

export type CropProtectionApplicationPreset = typeof cropProtectionApplicationPresets.$inferSelect;
export type CropProtectionApplicationPresetCreateInput = Omit<
  typeof cropProtectionApplicationPresets.$inferInsert,
  "id" | "farmId"
>;
export type CropProtectionApplicationPresetUpdateInput = Partial<CropProtectionApplicationPresetCreateInput>;

export type CropProtectionUnit = z.infer<typeof cropProtectionUnitSchema>;

export type CropProtectionApplicationCreateInput = Omit<
  typeof cropProtectionApplications.$inferInsert,
  "id" | "farmId" | "geometry"
> & {
  geometry: MultiPolygon;
};

export type CropProtectionApplicationBatchCreateInput = {
  createdBy: string;
  dateTime: Date;
  method?: CropProtectionApplication["method"];
  unit: CropProtectionApplication["unit"];
  additionalNotes?: string;
  productId: string;
  amountPerUnit: number;
  plots: {
    plotId: string;
    geometry: MultiPolygon;
    size: number;
    numberOfUnits: number;
  }[];
};
export type CropProtectionApplicationUpdateInput = Partial<CropProtectionApplicationCreateInput>;

export type CropProtectionApplication = typeof cropProtectionApplications.$inferSelect & {
  geometry: MultiPolygon;
  product: CropProtectionProduct;
  plot: Omit<Plot, "currentCropRotation" | "geometry">;
};

interface AppliedCropProtection {
  totalAmount: number;
  productName: string;
  unit: CropProtectionUnit;
}
interface MonthlyApplication {
  year: number;
  month: number;
  appliedCropProtections: AppliedCropProtection[];
}

export interface CropProtectionApplicationSummary {
  monthlyApplications: MonthlyApplication[];
}

export async function createCropProtectionApplication(
  input: CropProtectionApplicationCreateInput,
  farmId: string
): Promise<CropProtectionApplication> {
  const [result] = await appDrizzle
    .insert(cropProtectionApplications)
    .values({ farmId, ...input, geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)})` })
    .returning();
  const cropProtectionApplication = await getCropProtectionApplicationById(result.id);
  return cropProtectionApplication!;
}

export async function createCropProtectionApplications(
  { plots, ...base }: CropProtectionApplicationBatchCreateInput,
  farmId: string
): Promise<CropProtectionApplication[]> {
  const result = await appDrizzle
    .insert(cropProtectionApplications)
    .values(
      plots.map((plot) => ({
        farmId,
        ...base,
        ...plot,
        geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
      }))
    )
    .returning({ id: cropProtectionApplications.id });
  return getCropProtectionApplicationsByIds(result.map((a) => a.id));
}

export async function getCropProtectionApplicationsByIds(ids: string[]): Promise<CropProtectionApplication[]> {
  return appDrizzle.query.cropProtectionApplications.findMany({
    where: { id: { in: ids } },
    with: { plot: true, product: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
  });
}

export async function getCropProtectionApplicationById(id: string): Promise<CropProtectionApplication | undefined> {
  return appDrizzle.query.cropProtectionApplications.findFirst({
    where: { id },
    with: { plot: true, product: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
  });
}

export async function getCropProtectionApplicationsForPlot(plotId: string): Promise<CropProtectionApplication[]> {
  return appDrizzle.query.cropProtectionApplications.findMany({
    where: { plotId },
    with: { plot: true, product: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
    orderBy: { dateTime: "desc" },
  });
}

export async function getCropProtectionApplicationsForFarm(
  farmId: string,
  fromDate: Date,
  toDate: Date
): Promise<CropProtectionApplication[]> {
  return appDrizzle.query.cropProtectionApplications.findMany({
    where: { farmId, AND: [{ dateTime: { gte: fromDate } }, { dateTime: { lte: toDate } }] },
    with: { plot: true, product: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
    orderBy: { dateTime: "desc" },
  });
}

export async function updateCropProtectionApplication(
  id: string,
  data: CropProtectionApplicationUpdateInput
): Promise<CropProtectionApplication> {
  const geometry = data.geometry ? sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)})` : undefined;
  await appDrizzle
    .update(cropProtectionApplications)
    .set({ ...data, geometry })
    .where(eq(cropProtectionApplications.id, id));
  const cropProtectionApplication = await getCropProtectionApplicationById(id);
  return cropProtectionApplication!;
}

export async function deleteCropProtectionApplication(id: string): Promise<void> {
  await appDrizzle.delete(cropProtectionApplications).where(eq(cropProtectionApplications.id, id));
}

export async function getCropProtectionApplicationYears(farmId: string): Promise<string[]> {
  const result = await appDrizzle.query.cropProtectionApplications.findMany({
    where: { farmId },
    columns: { dateTime: true },
    orderBy: { dateTime: "asc" },
  });
  return Array.from(new Set(result.map((a) => a.dateTime.getFullYear().toString())));
}

export async function getCropProtectionApplicationSummaryForFarm(
  farmId: string
): Promise<CropProtectionApplicationSummary> {
  const result = await appDrizzle.query.cropProtectionApplications.findMany({
    where: { farmId },
    with: { product: true },
  });
  return mapToMonthlySummary(result);
}

export async function getCropProtectionApplicationSummaryForPlot(
  plotId: string
): Promise<CropProtectionApplicationSummary> {
  const result = await appDrizzle.query.cropProtectionApplications.findMany({
    where: { plotId },
    with: { product: true },
  });
  return mapToMonthlySummary(result);
}

export async function createCropProtectionApplicationPreset(
  input: CropProtectionApplicationPresetCreateInput,
  farmId: string
): Promise<CropProtectionApplicationPreset> {
  const [preset] = await appDrizzle
    .insert(cropProtectionApplicationPresets)
    .values({ farmId, ...input })
    .returning();
  return preset;
}

export async function getCropProtectionApplicationPresets(farmId: string): Promise<CropProtectionApplicationPreset[]> {
  return appDrizzle.query.cropProtectionApplicationPresets.findMany({ where: { farmId }, orderBy: { name: "asc" } });
}

export async function getCropProtectionApplicationPresetById(
  id: string
): Promise<CropProtectionApplicationPreset | undefined> {
  return appDrizzle.query.cropProtectionApplicationPresets.findFirst({ where: { id } });
}

export async function updateCropProtectionApplicationPreset(
  id: string,
  input: CropProtectionApplicationPresetUpdateInput
): Promise<CropProtectionApplicationPreset> {
  const [preset] = await appDrizzle
    .update(cropProtectionApplicationPresets)
    .set(input)
    .where(eq(cropProtectionApplicationPresets.id, id))
    .returning();
  return preset;
}

export async function deleteCropProtectionApplicationPreset(id: string): Promise<void> {
  await appDrizzle.delete(cropProtectionApplicationPresets).where(eq(cropProtectionApplicationPresets.id, id));
}

function mapToMonthlySummary(
  result: {
    numberOfUnits: number;
    amountPerUnit: number;
    dateTime: Date;
    product: { id: string; name: string; unit: CropProtectionUnit };
  }[]
): CropProtectionApplicationSummary {
  const applications = result.reduce<{
    [key: string]: {
      month: number;
      year: number;
      appliedCropProtections: Record<string, { totalAmount: number; unit: CropProtectionUnit; productName: string }>;
    };
  }>((acc, application) => {
    const date = application.dateTime;
    const year = date.getFullYear();
    const month = date.getMonth();
    const product = application.product;
    const key = `${year}-${month}`;
    if (!acc[key]) acc[key] = { month, year, appliedCropProtections: {} };
    if (!acc[key].appliedCropProtections[product.id]) {
      acc[key].appliedCropProtections[product.id] = {
        totalAmount: application.numberOfUnits * application.amountPerUnit,
        unit: application.product.unit,
        productName: product.name,
      };
    } else {
      acc[key].appliedCropProtections[product.id].totalAmount += application.numberOfUnits * application.amountPerUnit;
    }
    return acc;
  }, {});
  return {
    monthlyApplications: Object.values(applications).map(({ year, month, appliedCropProtections }) => ({
      year,
      month,
      appliedCropProtections: Object.values(appliedCropProtections),
    })),
  };
}
