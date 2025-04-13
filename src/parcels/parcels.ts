import { eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { MultiPolygon } from "../geo/geojson";

const parcelSelectColumns = {
  ...getTableColumns(tables.parcels),
  geometry: sql<MultiPolygon>`extensions.ST_AsGeoJSON(${tables.parcels.geometry})::json`,
};

export type CreateParcelInput = Omit<
  typeof tables.parcels.$inferInsert,
  "geometry" | "farmId"
> & {
  geometry: MultiPolygon;
};
export type UpdatedParcelInput = Partial<CreateParcelInput>;
type Parcel = Omit<typeof tables.parcels.$inferSelect, "geometry"> & {
  geometry: MultiPolygon;
};

export function parcelsApi(db: RlsDb) {
  return {
    async copyFromFederalParcel(gisIds: number[]) {
      return db.rls(async (tx) => {
        const federalParcels = await tx
          .select({
            ...getTableColumns(tables.federalParcels),
            geometry: sql<MultiPolygon>`ST_AsGeoJSON(${tables.federalParcels.geometry})::json`,
          })
          .from(tables.federalParcels)
          .where(inArray(tables.federalParcels.gisId, gisIds));

        if (federalParcels.length !== gisIds.length) {
          throw new Error("Could not find all federal parcels");
        }
        const parcels: CreateParcelInput[] = federalParcels.map(
          (federalParcel) => ({
            gisId: federalParcel.gisId,
            communalId: federalParcel.communalId,
            area: federalParcel.area,
            geometry: federalParcel.geometry,
            size: federalParcel.area,
          })
        );
        return this.createParcels(parcels);
      });
    },
    async createParcels(parcels: CreateParcelInput[]): Promise<Parcel[]> {
      return db.rls(async (tx) => {
        const parcelsToInsert = parcels.map((parcel) => ({
          ...tables.farmIdColumnValue,
          ...parcel,
          geometry: sql`ST_GeomFromGeoJSON(${JSON.stringify(parcel.geometry)})`,
        }));

        return tx
          .insert(tables.parcels)
          .values(parcelsToInsert)
          .returning(parcelSelectColumns);
      });
    },
    async getParcelById(id: string): Promise<Parcel> {
      return db.rls(async (tx) => {
        const result = await tx
          .select(parcelSelectColumns)
          .from(tables.parcels)
          .where(eq(tables.parcels.id, id));

        if (!result.length) {
          throw new Error(`Farm Parcel with id ${id} not found`);
        }

        // since we only pass one parcel
        return result[0];
      });
    },
    async getParcelsForFarm(farmId: string): Promise<Parcel[]> {
      return db.rls(async (tx) => {
        return tx
          .select(parcelSelectColumns)
          .from(tables.parcels)
          .where(eq(tables.parcels.farmId, farmId));
      });
    },
    async updateParcel(
      id: string,
      updatedFarmParcel: UpdatedParcelInput
    ): Promise<Parcel> {
      return db.rls(async (tx) => {
        const result = await tx
          .update(tables.parcels)
          .set({
            ...updatedFarmParcel,
            geometry: sql`ST_GeomFromGeoJSON(${updatedFarmParcel.geometry})`,
          })
          .where(eq(tables.parcels.id, id))
          .returning(parcelSelectColumns);

        return result[0];
      });
    },
    async deleteFarmParcel(id: string): Promise<void> {
      throw new Error("not implemented");
      //   await db.delete(farmParcels).where(eq(farmParcels.id, id));
    },
  };
}
