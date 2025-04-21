import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { farmIdColumnValue, tillages } from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { TillageEquipment } from "../equipment/tillage-equipment";
import { Plot } from "../plots/plots";

export type TillageCreateInput = Omit<
  typeof tillages.$inferInsert,
  "id" | "farmId" | "geometry"
> & {
  geometry: MultiPolygon;
};

export type TillageBatchCreateInput = {
  createdBy: string;
  date: Date;
  reason: Tillage["reason"];
  action: Tillage["action"];
  additionalNotes?: string;
  equipmentId?: string;
  plots: {
    plotId: string;
    geometry: MultiPolygon;
    size: number;
  }[];
};
export type TillageUpdateInput = Partial<TillageCreateInput>;

export type Tillage = typeof tillages.$inferSelect & {
  equipment: TillageEquipment | null;
  geometry: MultiPolygon;
  plot: Omit<Plot, "cropRotations" | "geometry">;
};

export function tillagesApi(rlsDb: RlsDb) {
  return {
    async createTillage(input: TillageCreateInput): Promise<Tillage> {
      const result = await rlsDb.rls(async (tx) => {
        const [tillage] = await tx
          .insert(tillages)
          .values({
            ...farmIdColumnValue,
            ...input,
            geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)})`,
          })
          .returning();
        return tillage;
      });
      const tillage = await this.getTillageById(result.id);
      return tillage!;
    },
    async createTillages({
      plots,
      ...base
    }: TillageBatchCreateInput): Promise<Tillage[]> {
      const result = await rlsDb.rls(async (tx) => {
        return tx
          .insert(tillages)
          .values(
            plots.map((plot) => ({
              ...farmIdColumnValue,
              ...base,
              ...plot,
              geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
            }))
          )
          .returning({ id: tillages.id });
      });
      return this.getTillagesByIds(
        result.map((application) => application.id)
      )!;
    },
    async getTillagesByIds(ids: string[]): Promise<Tillage[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.tillages.findMany({
          where: inArray(tillages.id, ids),
          with: {
            equipment: true,
            plot: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${tillages.geometry})::json`.as(
                "geometry"
              ),
          },
        });
      });
    },
    async getTillageById(id: string): Promise<Tillage | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.tillages.findFirst({
          where: eq(tillages.id, id),
          with: {
            equipment: true,
            plot: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${tillages.geometry})::json`.as(
                "geometry"
              ),
          },
        });
      });
    },
    async getTillagesForFarm(
      farmId: string,
      fromDate: Date,
      toDate: Date
    ): Promise<Tillage[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.tillages.findMany({
          where: and(
            eq(tillages.farmId, farmId),
            and(gte(tillages.date, fromDate), lte(tillages.date, toDate))
          ),
          with: {
            equipment: true,
            plot: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${tillages.geometry})::json`.as(
                "geometry"
              ),
          },
          orderBy: [desc(tillages.date)],
        });
      });
    },
    async getTillagesForPlot(plotId: string): Promise<Tillage[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.tillages.findMany({
          where: eq(tillages.plotId, plotId),
          with: {
            equipment: true,
            plot: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${tillages.geometry})::json`.as(
                "geometry"
              ),
          },
          orderBy: [desc(tillages.date)],
        });
      });
    },
    async updateTillage(
      id: string,
      data: TillageUpdateInput
    ): Promise<Tillage> {
      const result = await rlsDb.rls(async (tx) => {
        const geometry = data.geometry
          ? sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)})`
          : undefined;

        const [tillage] = await tx
          .update(tillages)
          .set({ ...data, geometry })
          .where(eq(tillages.id, id))
          .returning();
        return tillage;
      });
      const tillage = await this.getTillageById(result.id);
      return tillage!;
    },
    async deleteTillage(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(tillages).where(eq(tillages.id, id));
      });
    },
    async getTillagesYears(): Promise<string[]> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.tillages.findMany({
          columns: {
            date: true,
          },
          orderBy: [desc(tillages.date)],
        });

        return Array.from(
          new Set(
            result.map((application) =>
              application.date.getFullYear().toString()
            )
          )
        );
      });
    },
  };
}
