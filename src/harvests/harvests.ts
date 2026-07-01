import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { appDrizzle } from "../db/db";
import * as tables from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { Plot } from "../plots/plots";

export type HarvestPreset = typeof tables.harvestPresets.$inferSelect;
export type HarvestPresetCreateInput = Omit<typeof tables.harvestPresets.$inferInsert, "id" | "farmId">;
export type HarvestPresetUpdateInput = Partial<HarvestPresetCreateInput>;

export type Harvest = Omit<typeof tables.harvests.$inferSelect, "geometry"> & {
  geometry: MultiPolygon;
  crop: typeof tables.crops.$inferSelect;
  plot: Omit<Plot, "currentCropRotation">;
};

export type HarvestCreateInput = {
  date: Date;
  plotId: string;
  cropId: string;
  conservationMethod: z.infer<typeof tables.conservationMethodEnumSchema>;
  producedUnits: number;
  kilosPerUnit: number;
  createdBy: string;
  harvestCount?: number | null;
  unit: z.infer<typeof tables.harvestUnitsSchema>;
  additionalNotes?: string | null;
};
export type HarvestsBatchCreateInput = {
  date: Date;
  cropId: string;
  conservationMethod?: z.infer<typeof tables.conservationMethodEnumSchema> | null;
  kilosPerUnit: number;
  createdBy: string;
  harvestCount?: number | null;
  unit: z.infer<typeof tables.harvestUnitsSchema>;
  additionalNotes?: string | null;
  plots: {
    plotId: string;
    geometry: MultiPolygon;
    size: number;
    numberOfUnits: number;
  }[];
};
export type HarvestUpdateInput = Partial<HarvestCreateInput>;

interface ProducedQuantity {
  totalAmountInKilos: number;
  forageName: string;
  conservationMethod: string | null;
  producedUnits: { unit: string; totalAmountInKilos: number; totalProducedUnits: number }[];
}

interface MonthlyHarvest {
  year: number;
  month: number;
  producedQuantities: ProducedQuantity[];
}

export interface HarvestSummary {
  monthlyHarvests: MonthlyHarvest[];
}

export async function createHarvests({ plots, ...base }: HarvestsBatchCreateInput, farmId: string): Promise<Harvest[]> {
  const result = await appDrizzle
    .insert(tables.harvests)
    .values(
      plots.map((plot) => ({
        farmId,
        ...base,
        ...plot,
        geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
      }))
    )
    .returning({ id: tables.harvests.id });
  return getHarvestsByIds(result.map((h) => h.id));
}

export async function deleteHarvest(id: string): Promise<void> {
  await appDrizzle.delete(tables.harvests).where(eq(tables.harvests.id, id));
}

export async function getHarvestsByIds(ids: string[]): Promise<Harvest[]> {
  return appDrizzle.query.harvests.findMany({
    where: { id: { in: ids } },
    with: {
      crop: true,
      plot: { extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") } },
    },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
  });
}

export async function getHarvestById(id: string): Promise<Harvest | undefined> {
  return appDrizzle.query.harvests.findFirst({
    where: { id },
    with: {
      crop: true,
      plot: { extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") } },
    },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
  });
}

export async function getHarvestsForFarm(farmId: string, fromDate: Date, toDate: Date): Promise<Harvest[]> {
  return appDrizzle.query.harvests.findMany({
    where: { farmId, AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }] },
    with: {
      crop: true,
      plot: { extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") } },
    },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
    orderBy: { date: "desc" },
  });
}

export async function getHarvestsForPlot(plotId: string): Promise<Omit<Harvest, "plot">[]> {
  return appDrizzle.query.harvests.findMany({
    where: { plotId },
    with: { crop: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
    orderBy: { date: "desc" },
  });
}

export async function getHarvestYears(farmId: string): Promise<string[]> {
  const result = await appDrizzle.query.harvests.findMany({
    where: { farmId },
    columns: { date: true },
    orderBy: { date: "desc" },
  });
  return Array.from(new Set(result.map((h) => h.date.getFullYear().toString())));
}

export async function getHarvestSummaryForFarm(farmId: string): Promise<HarvestSummary> {
  const results = await appDrizzle.query.harvests.findMany({
    where: { farmId },
    columns: { geometry: false },
    with: { crop: true },
  });
  return mapToMonthlySummaries(results);
}

export async function getHarvestSummaryForPlot(plotId: string): Promise<HarvestSummary> {
  const results = await appDrizzle.query.harvests.findMany({
    where: { plotId },
    columns: { geometry: false },
    with: { crop: true },
  });
  return mapToMonthlySummaries(results);
}

export async function createHarvestPreset(input: HarvestPresetCreateInput, farmId: string): Promise<HarvestPreset> {
  const [preset] = await appDrizzle
    .insert(tables.harvestPresets)
    .values({ farmId, ...input })
    .returning();
  return preset;
}

export async function getHarvestPresets(farmId: string): Promise<HarvestPreset[]> {
  return appDrizzle.query.harvestPresets.findMany({ where: { farmId }, orderBy: { name: "asc" } });
}

export async function getHarvestPresetById(id: string): Promise<HarvestPreset | undefined> {
  return appDrizzle.query.harvestPresets.findFirst({ where: { id } });
}

export async function updateHarvestPreset(id: string, input: HarvestPresetUpdateInput): Promise<HarvestPreset> {
  const [preset] = await appDrizzle
    .update(tables.harvestPresets)
    .set(input)
    .where(eq(tables.harvestPresets.id, id))
    .returning();
  return preset;
}

export async function deleteHarvestPreset(id: string): Promise<void> {
  await appDrizzle.delete(tables.harvestPresets).where(eq(tables.harvestPresets.id, id));
}

function mapToMonthlySummaries(harvests: Omit<Harvest, "geometry" | "plot">[]): HarvestSummary {
  const monthlyHarvests = harvests.reduce<
    Record<
      string,
      {
        year: number;
        month: number;
        producedQuantities: Record<
          string,
          {
            totalAmountInKilos: number;
            forageName: string;
            conservationMethod: string | null;
            producedUnits: { [unit: string]: { unit: string; totalAmountInKilos: number; totalProducedUnits: number } };
          }
        >;
      }
    >
  >((acc, harvest) => {
    const date = harvest.date;
    const year = date.getFullYear();
    const month = date.getMonth();
    const forageKey = `${harvest.crop.name}-${harvest.conservationMethod}`;
    const key = `${year}-${month}`;
    if (!acc[key]) acc[key] = { year, month, producedQuantities: {} };
    if (!acc[key].producedQuantities[forageKey]) {
      acc[key].producedQuantities[forageKey] = {
        forageName: harvest.crop.name,
        totalAmountInKilos: 0,
        conservationMethod: harvest.conservationMethod,
        producedUnits: {},
      };
    }
    if (!acc[key].producedQuantities[forageKey].producedUnits[harvest.unit]) {
      acc[key].producedQuantities[forageKey].producedUnits[harvest.unit] = {
        unit: harvest.unit,
        totalAmountInKilos: 0,
        totalProducedUnits: 0,
      };
    }
    acc[key].producedQuantities[forageKey].totalAmountInKilos += harvest.numberOfUnits * harvest.kilosPerUnit;
    acc[key].producedQuantities[forageKey].producedUnits[harvest.unit].totalAmountInKilos +=
      harvest.numberOfUnits * harvest.kilosPerUnit;
    acc[key].producedQuantities[forageKey].producedUnits[harvest.unit].totalProducedUnits += harvest.numberOfUnits;
    return acc;
  }, {});

  return {
    monthlyHarvests: Object.values(monthlyHarvests)
      .map((mh) => ({
        ...mh,
        producedQuantities: Object.values(mh.producedQuantities).map((pq) => ({
          ...pq,
          producedUnits: Object.values(pq.producedUnits),
        })),
      }))
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year)),
  };
}
