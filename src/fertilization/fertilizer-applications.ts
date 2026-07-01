import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { appDrizzle } from "../db/db";
import {
  fertilizerApplications,
  fertilizers,
  plots,
  fertilizerUnitSchema,
  fertilizationMethodSchema,
  fertilizerApplicationUnitSchema,
  fertilizerApplicationPresets,
} from "../db/schema";
import { MultiPolygon } from "../geo/geojson";

export type FertilizerApplicationPreset = typeof fertilizerApplicationPresets.$inferSelect & {
  fertilizer: typeof fertilizers.$inferSelect;
};
export type FertilizerApplicationPresetCreateInput = Omit<
  typeof fertilizerApplicationPresets.$inferInsert,
  "id" | "farmId"
>;
export type FertilizerApplicationPresetUpdateInput = Partial<FertilizerApplicationPresetCreateInput>;

export type FertilizerApplicationUnit = z.infer<typeof fertilizerApplicationUnitSchema>;
export type FertilizerUnit = z.infer<typeof fertilizerUnitSchema>;
export type FertilizationMethod = z.infer<typeof fertilizationMethodSchema>;

export type FertilizerApplicationApplicationBatchCreateInput = {
  date: Date;
  createdBy: string;
  unit: FertilizerApplicationUnit;
  method?: FertilizationMethod;
  fertilizerId: string;
  amountPerUnit: number;
  additionalNotes?: string;
  plots: {
    plotId: string;
    geometry: MultiPolygon;
    size: number;
    numberOfUnits: number;
  }[];
};

type FertilizerApplication = Omit<typeof fertilizerApplications.$inferSelect, "geometry"> & {
  geometry: MultiPolygon;
  fertilizer: typeof fertilizers.$inferSelect;
  plot: Pick<typeof plots.$inferSelect, "id" | "name">;
};

interface AppliedFertilizer {
  totalAmount: number;
  fertilizerName: string;
  unit: FertilizerUnit;
}
interface MonthlyApplication {
  year: number;
  month: number;
  appliedFertilizers: AppliedFertilizer[];
}

export interface FertilizationApplicationSummary {
  monthlyApplications: MonthlyApplication[];
}

export async function createFertilizerApplications(
  { plots: plotInputs, ...base }: FertilizerApplicationApplicationBatchCreateInput,
  farmId: string
): Promise<FertilizerApplication[]> {
  const result = await appDrizzle
    .insert(fertilizerApplications)
    .values(
      plotInputs.map((plot) => ({
        farmId,
        ...base,
        ...plot,
        geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
      }))
    )
    .returning({ id: fertilizerApplications.id });
  return getFertilizerApplicationsByIds(result.map((a) => a.id));
}

export async function getFertilizerApplicationsByIds(ids: string[]): Promise<FertilizerApplication[]> {
  return appDrizzle.query.fertilizerApplications.findMany({
    where: { id: { in: ids } },
    with: {
      fertilizer: true,
      plot: { columns: { id: true, name: true } },
    },
    extras: {
      geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry"),
    },
  });
}

export async function getFertilizerApplicationById(id: string): Promise<FertilizerApplication | undefined> {
  return appDrizzle.query.fertilizerApplications.findFirst({
    where: { id },
    with: {
      fertilizer: true,
      plot: { columns: { id: true, name: true } },
    },
    extras: {
      geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry"),
    },
  });
}

export async function getFertilizerApplicationsForFarm(
  farmId: string,
  fromDate: Date,
  toDate: Date
): Promise<FertilizerApplication[]> {
  return appDrizzle.query.fertilizerApplications.findMany({
    where: { farmId, AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }] },
    with: {
      plot: { columns: { id: true, name: true } },
      fertilizer: true,
    },
    extras: {
      geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry"),
    },
    orderBy: { date: "desc" },
  });
}

export async function getFertilizerApplicationsForPlot(plotId: string): Promise<Omit<FertilizerApplication, "plot">[]> {
  return appDrizzle.query.fertilizerApplications.findMany({
    where: { plotId },
    with: { fertilizer: true },
    extras: {
      geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry"),
    },
    orderBy: { date: "desc" },
  });
}

export async function deleteFertilizerApplication(id: string): Promise<void> {
  await appDrizzle.delete(fertilizerApplications).where(eq(fertilizerApplications.id, id));
}

export async function getFertilizerApplicationYears(farmId: string): Promise<string[]> {
  const result = await appDrizzle.query.fertilizerApplications.findMany({
    where: { farmId },
    columns: { date: true },
    orderBy: { date: "desc" },
  });
  return Array.from(new Set(result.map((a) => a.date.getFullYear().toString())));
}

export async function getFertilizerApplicationSummaryForFarm(farmId: string): Promise<FertilizationApplicationSummary> {
  const result = await appDrizzle.query.fertilizerApplications.findMany({
    where: { farmId },
    columns: { numberOfUnits: true, amountPerUnit: true, unit: true, date: true },
    with: { fertilizer: { columns: { name: true, unit: true } } },
  });
  return mapToMonthlySummary(result);
}

export async function getFertilizerApplicationSummaryForPlot(plotId: string): Promise<FertilizationApplicationSummary> {
  const result = await appDrizzle.query.fertilizerApplications.findMany({
    where: { plotId },
    columns: { numberOfUnits: true, amountPerUnit: true, unit: true, date: true },
    with: { fertilizer: { columns: { name: true, unit: true } } },
  });
  return mapToMonthlySummary(result);
}

export async function createFertilizerApplicationPreset(
  input: FertilizerApplicationPresetCreateInput,
  farmId: string
): Promise<FertilizerApplicationPreset> {
  const [preset] = await appDrizzle
    .insert(fertilizerApplicationPresets)
    .values({ farmId, ...input })
    .returning();
  const full = await getFertilizerApplicationPresetById(preset.id);
  return full!;
}

export async function getFertilizerApplicationPresets(farmId: string): Promise<FertilizerApplicationPreset[]> {
  return appDrizzle.query.fertilizerApplicationPresets.findMany({
    where: { farmId },
    with: { fertilizer: true },
    orderBy: { name: "asc" },
  });
}

export async function getFertilizerApplicationPresetById(id: string): Promise<FertilizerApplicationPreset | undefined> {
  return appDrizzle.query.fertilizerApplicationPresets.findFirst({
    where: { id },
    with: { fertilizer: true },
  });
}

export async function updateFertilizerApplicationPreset(
  id: string,
  input: FertilizerApplicationPresetUpdateInput
): Promise<FertilizerApplicationPreset> {
  await appDrizzle.update(fertilizerApplicationPresets).set(input).where(eq(fertilizerApplicationPresets.id, id));
  const preset = await getFertilizerApplicationPresetById(id);
  return preset!;
}

export async function deleteFertilizerApplicationPreset(id: string): Promise<void> {
  await appDrizzle.delete(fertilizerApplicationPresets).where(eq(fertilizerApplicationPresets.id, id));
}

function mapToMonthlySummary(
  result: {
    numberOfUnits: number;
    amountPerUnit: number;
    date: Date;
    fertilizer: { name: string; unit: FertilizerUnit };
  }[]
): FertilizationApplicationSummary {
  const applications = result.reduce<{
    [key: string]: {
      month: number;
      year: number;
      appliedFertilizers: Record<string, { totalAmount: number; unit: FertilizerUnit; fertilizerName: string }>;
    };
  }>((acc, application) => {
    const date = application.date;
    const year = date.getFullYear();
    const month = date.getMonth();
    const fertilizerName = application.fertilizer.name;
    const key = `${year}-${month}`;
    if (!acc[key]) {
      acc[key] = { month, year, appliedFertilizers: {} };
    }
    if (!acc[key].appliedFertilizers[fertilizerName]) {
      acc[key].appliedFertilizers[fertilizerName] = {
        totalAmount: application.numberOfUnits * application.amountPerUnit,
        unit: application.fertilizer.unit,
        fertilizerName,
      };
    } else {
      acc[key].appliedFertilizers[fertilizerName].totalAmount += application.numberOfUnits * application.amountPerUnit;
    }
    return acc;
  }, {});
  return {
    monthlyApplications: Object.values(applications).map(({ year, month, appliedFertilizers }) => ({
      year,
      month,
      appliedFertilizers: Object.values(appliedFertilizers),
    })),
  };
}
