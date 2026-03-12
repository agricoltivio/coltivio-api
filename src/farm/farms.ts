import createHttpError from "http-errors";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { TFunction } from "i18next";
import {} from "../crop-rotations/crop-rotations";
import { mapCodesToCrops, UNKNOWN_CROP_CODE } from "../crops/codeToCropsMapper";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { MultiPolygon, Point } from "../geo/geojson";
import { User } from "../user/users";

const farmSelectColumns = {
  ...getTableColumns(tables.farms),
  location: sql<Point>`extensions.ST_AsGeoJSON(${tables.farms.location})::json`,
};

export type FarmCreateInput = {
  name: string;
  address: string;
  federalId?: string | null;
  tvdNumber?: string | null;
  location: Point;
};

export function farmsApi(rlsDb: RlsDb, t: TFunction) {
  return {
    async getFarmById(farmId: string) {
      return rlsDb.rls(async (tx) => {
        const [farm] = await tx
          .select(farmSelectColumns)
          .from(tables.farms)
          .where(eq(tables.farms.id, farmId));
        return farm;
      });
    },
    async createFarm(userId: string, farm: FarmCreateInput) {
      // we need to bypass rls because farm is not yet created, so the returning statement would fail
      return rlsDb.admin.transaction(async (tx) => {
        const { location, ...rest } = farm;
        const [createdFarm] = await tx
          .insert(tables.farms)
          .values({
            ...rest,
            location: sql`ST_GeomFromGeoJSON(${JSON.stringify(location)})`,
          })
          .returning(farmSelectColumns);

        // assign user to farm as owner
        await tx
          .update(tables.profiles)
          .set({
            farmId: createdFarm.id,
            farmRole: "owner",
          })
          .where(eq(tables.profiles.id, userId));

        if (!farm.federalId) {
          await tx
            .insert(tables.crops)
            .values([
              {
                farmId: createdFarm.id,
                name: t("crops.natural_meadow"),
                category: "grass",
              },
            ])
            .returning();
        }

        if (farm.federalId) {
          const federalFarmPlots = await tx
            .select({
              ...getTableColumns(tables.federalFarmPlots),
              geometry: sql<MultiPolygon>`ST_AsGeoJSON(${tables.federalFarmPlots.geometry})::json`,
            })
            .from(tables.federalFarmPlots)
            .where(eq(tables.federalFarmPlots.federalFarmId, farm.federalId))
            .orderBy(tables.federalFarmPlots.localId);

          // copy parcels from federal parcels

          // if (federalParcels.length !== farm.parcelGisIds.length) {
          //   throw new Error("Could not find all federal parcels");
          // }
          // const parcels: CreateParcelInput[] = federalFarmPlots.map(
          //   (federalParcel) => ({
          //     gisId: federalParcel.gisId,
          //     communalId: federalParcel.communalId,
          //     area: federalParcel.area,
          //     geometry: federalParcel.geometry,
          //     size: federalParcel.area,
          //   })
          // );

          // await tx.insert(tables.parcels).values(
          //   parcels.map((parcel) => ({
          //     farmId: createdFarm.id,
          //     ...parcel,
          //     geometry: sql`ST_GeomFromGeoJSON(${JSON.stringify(parcel.geometry)})`,
          //   }))
          // );

          const plotsToCreate = federalFarmPlots.map((plot, index) => {
            return {
              farmId: createdFarm.id,
              name: plot.localId ?? `${index + 1}`,
              size: plot.size,
              localId: plot.localId,
              usage: plot.usage,
              cuttingDate: plot.cuttingDate,
              geometry: sql`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
            };
          });

          const plots = await tx
            .insert(tables.plots)
            .values(plotsToCreate)
            .returning();

          const cropCreateInputs = mapCodesToCrops(
            plots.map((plot) => plot.usage ?? UNKNOWN_CROP_CODE),
            t,
          );

          const crops = await tx
            .insert(tables.crops)
            .values(
              cropCreateInputs.map((crop) => ({
                ...crop,
                farmId: createdFarm.id,
              })),
            )
            .returning();

          const currentYear = new Date().getFullYear();
          const fromDate = new Date(Date.UTC(currentYear, 0, 1)); // Jan 1
          const toDate = new Date(Date.UTC(currentYear, 11, 31)); // Dec 31

          const cropRotationInputs = plots.map((plot) => ({
            farmId: createdFarm.id,
            cropId: crops.find((crop) =>
              crop.usageCodes.includes(plot.usage ?? UNKNOWN_CROP_CODE),
            )!.id,
            fromDate,
            toDate,
            plotId: plot.id,
          }));

          const createdRotations = await tx
            .insert(tables.cropRotations)
            .values(cropRotationInputs)
            .returning();

          // Create yearly recurrences for permanent rotations
          await tx.insert(tables.cropRotationYearlyRecurrences).values(
            createdRotations.map((rotation) => ({
              farmId: createdFarm.id,
              cropRotationId: rotation.id,
              interval: 1,
            })),
          );
        }

        return createdFarm;
      });
    },
    async getFarmUsers(farmId: string): Promise<User[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(tables.profiles)
          .where(eq(tables.profiles.farmId, farmId));
      });
    },
    async updateFarm(farmId: string, data: Partial<FarmCreateInput>) {
      return rlsDb.rls(async (tx) => {
        const { location, ...rest } = data;
        const [updatedFarm] = await tx
          .update(tables.farms)
          .set({
            ...rest,
            location: location
              ? sql`ST_GeomFromGeoJSON(${JSON.stringify(location)})`
              : undefined,
          })
          .where(eq(tables.farms.id, farmId))
          .returning(farmSelectColumns);
        return updatedFarm;
      });
    },
    async deleteFarm(farmId: string) {
      return rlsDb.rls(async (tx) => {
        return tx.delete(tables.farms).where(eq(tables.farms.id, farmId));
      });
    },
    async kickMember(targetUserId: string, callerUserId: string, farmId: string) {
      return rlsDb.admin.transaction(async (tx) => {
        const farmMembers = await tx.query.profiles.findMany({ where: { farmId } });

        const caller = farmMembers.find((p) => p.id === callerUserId);
        if (!caller || caller.farmRole !== "owner") {
          throw createHttpError(403, "Only farm owners can kick members");
        }

        const target = farmMembers.find((p) => p.id === targetUserId);
        if (!target) {
          throw createHttpError(404, "Member not found in this farm");
        }

        if (target.farmRole === "owner") {
          const ownerCount = farmMembers.filter((p) => p.farmRole === "owner").length;
          if (ownerCount <= 1) {
            throw createHttpError(400, "Cannot remove the only owner");
          }
        }

        await tx
          .update(tables.profiles)
          .set({ farmId: null, farmRole: null })
          .where(eq(tables.profiles.id, targetUserId));
      });
    },
    async changeMemberRole(
      targetUserId: string,
      callerId: string,
      farmId: string,
      newRole: "owner" | "member",
    ) {
      return rlsDb.admin.transaction(async (tx) => {
        const farmMembers = await tx.query.profiles.findMany({ where: { farmId } });

        const caller = farmMembers.find((p) => p.id === callerId);
        if (!caller || caller.farmRole !== "owner") {
          throw createHttpError(403, "Only farm owners can change member roles");
        }

        const target = farmMembers.find((p) => p.id === targetUserId);
        if (!target) {
          throw createHttpError(404, "Member not found in this farm");
        }

        if (newRole === "member" && target.farmRole === "owner") {
          const ownerCount = farmMembers.filter((p) => p.farmRole === "owner").length;
          if (ownerCount <= 1) {
            throw createHttpError(400, "Cannot demote the only owner");
          }
        }

        const [updatedProfile] = await tx
          .update(tables.profiles)
          .set({ farmRole: newRole })
          .where(eq(tables.profiles.id, targetUserId))
          .returning();

        return updatedProfile;
      });
    },
  };
}
