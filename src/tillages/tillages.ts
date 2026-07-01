import { eq, sql } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { tillages, tillagePresets } from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { Plot } from "../plots/plots";

export type TillagePreset = typeof tillagePresets.$inferSelect;
export type TillagePresetCreateInput = Omit<typeof tillagePresets.$inferInsert, "id" | "farmId">;
export type TillagePresetUpdateInput = Partial<TillagePresetCreateInput>;

export type TillageCreateInput = Omit<typeof tillages.$inferInsert, "id" | "farmId" | "geometry"> & {
  geometry: MultiPolygon;
};

export type TillageBatchCreateInput = {
  createdBy: string;
  date: Date;
  action: Tillage["action"];
  customAction?: string;
  additionalNotes?: string | null;
  plots: {
    plotId: string;
    geometry: MultiPolygon;
    size: number;
  }[];
};
export type TillageUpdateInput = Partial<TillageCreateInput>;

export type Tillage = typeof tillages.$inferSelect & {
  geometry: MultiPolygon;
  plot: Omit<Plot, "currentCropRotation" | "geometry">;
};

export async function createTillage(input: TillageCreateInput, farmId: string): Promise<Tillage> {
  const [result] = await appDrizzle
    .insert(tillages)
    .values({ farmId, ...input, geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)})` })
    .returning();
  const tillage = await getTillageById(result.id);
  return tillage!;
}

export async function createTillages(
  { plots: plotInputs, ...base }: TillageBatchCreateInput,
  farmId: string
): Promise<Tillage[]> {
  const result = await appDrizzle
    .insert(tillages)
    .values(
      plotInputs.map((plot) => ({
        farmId,
        ...base,
        ...plot,
        geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
      }))
    )
    .returning({ id: tillages.id });
  return getTillagesByIds(result.map((t) => t.id));
}

export async function getTillagesByIds(ids: string[]): Promise<Tillage[]> {
  return appDrizzle.query.tillages.findMany({
    where: { id: { in: ids } },
    with: { plot: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
  });
}

export async function getTillageById(id: string): Promise<Tillage | undefined> {
  return appDrizzle.query.tillages.findFirst({
    where: { id },
    with: { plot: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
  });
}

export async function getTillagesForFarm(farmId: string, fromDate: Date, toDate: Date): Promise<Tillage[]> {
  return appDrizzle.query.tillages.findMany({
    where: { farmId, AND: [{ date: { gte: fromDate } }, { date: { lte: toDate } }] },
    with: { plot: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
    orderBy: { date: "desc" },
  });
}

export async function getTillagesForPlot(plotId: string): Promise<Tillage[]> {
  return appDrizzle.query.tillages.findMany({
    where: { plotId },
    with: { plot: true },
    extras: { geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry") },
    orderBy: { date: "desc" },
  });
}

export async function updateTillage(id: string, data: TillageUpdateInput): Promise<Tillage> {
  const geometry = data.geometry ? sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)})` : undefined;
  await appDrizzle
    .update(tillages)
    .set({ ...data, geometry })
    .where(eq(tillages.id, id));
  const tillage = await getTillageById(id);
  return tillage!;
}

export async function deleteTillage(id: string): Promise<void> {
  await appDrizzle.delete(tillages).where(eq(tillages.id, id));
}

export async function getTillagesYears(farmId: string): Promise<string[]> {
  const result = await appDrizzle.query.tillages.findMany({
    where: { farmId },
    columns: { date: true },
    orderBy: { date: "desc" },
  });
  return Array.from(new Set(result.map((t) => t.date.getFullYear().toString())));
}

export async function createTillagePreset(input: TillagePresetCreateInput, farmId: string): Promise<TillagePreset> {
  const [preset] = await appDrizzle
    .insert(tillagePresets)
    .values({ farmId, ...input })
    .returning();
  return preset;
}

export async function getTillagePresets(farmId: string): Promise<TillagePreset[]> {
  return appDrizzle.query.tillagePresets.findMany({ where: { farmId }, orderBy: { name: "asc" } });
}

export async function getTillagePresetById(id: string): Promise<TillagePreset | undefined> {
  return appDrizzle.query.tillagePresets.findFirst({ where: { id } });
}

export async function updateTillagePreset(id: string, input: TillagePresetUpdateInput): Promise<TillagePreset> {
  const [preset] = await appDrizzle.update(tillagePresets).set(input).where(eq(tillagePresets.id, id)).returning();
  return preset;
}

export async function deleteTillagePreset(id: string): Promise<void> {
  await appDrizzle.delete(tillagePresets).where(eq(tillagePresets.id, id));
}
