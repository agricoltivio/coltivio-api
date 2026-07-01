import createHttpError from "http-errors";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { TFunction } from "i18next";
import { mapCodesToCrops, UNKNOWN_CROP_CODE } from "../crops/codeToCropsMapper";
import { appDrizzle } from "../db/db";
import * as tables from "../db/schema";
import { MultiPolygon, Point } from "../geo/geojson";
import { User } from "../user/users";

const farmSelectColumns = {
  ...getTableColumns(tables.farms),
  location: sql<Point>`ST_AsGeoJSON(${tables.farms.location})::json`,
};

export type FarmCreateInput = {
  name: string;
  address: string;
  federalId?: string | null;
  tvdNumber?: string | null;
  location: Point;
};

export async function getFarmById(farmId: string) {
  const [farm] = await appDrizzle.select(farmSelectColumns).from(tables.farms).where(eq(tables.farms.id, farmId));
  return farm;
}

export async function createFarm(userId: string, farm: FarmCreateInput, t: TFunction) {
  return appDrizzle.transaction(async (tx) => {
    const { location, ...rest } = farm;
    const [createdFarm] = await tx
      .insert(tables.farms)
      .values({ ...rest, location: sql`ST_GeomFromGeoJSON(${JSON.stringify(location)})` })
      .returning(farmSelectColumns);

    await tx
      .update(tables.profiles)
      .set({ farmId: createdFarm.id, farmRole: "owner" })
      .where(eq(tables.profiles.id, userId));

    if (!farm.federalId) {
      await tx
        .insert(tables.crops)
        .values([{ farmId: createdFarm.id, name: t("crops.natural_meadow"), category: "grass" }]);
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

      const plotsToCreate = federalFarmPlots.map((plot, index) => ({
        farmId: createdFarm.id,
        name: plot.localId ?? `${index + 1}`,
        size: plot.size,
        localId: plot.localId,
        usage: plot.usage,
        cuttingDate: plot.cuttingDate,
        geometry: sql`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
      }));

      const plots = await tx.insert(tables.plots).values(plotsToCreate).returning();

      const cropCreateInputs = mapCodesToCrops(
        plots.map((plot) => plot.usage ?? UNKNOWN_CROP_CODE),
        t
      );
      const crops = await tx
        .insert(tables.crops)
        .values(cropCreateInputs.map((crop) => ({ ...crop, farmId: createdFarm.id })))
        .returning();

      const currentYear = new Date().getFullYear();
      const fromDate = new Date(Date.UTC(currentYear, 0, 1));
      const toDate = new Date(Date.UTC(currentYear, 11, 31));

      const cropRotationInputs = plots.map((plot) => ({
        farmId: createdFarm.id,
        cropId: crops.find((crop) => crop.usageCodes.includes(plot.usage ?? UNKNOWN_CROP_CODE))!.id,
        fromDate,
        toDate,
        plotId: plot.id,
      }));

      const createdRotations = await tx.insert(tables.cropRotations).values(cropRotationInputs).returning();

      await tx
        .insert(tables.cropRotationYearlyRecurrences)
        .values(
          createdRotations.map((rotation) => ({ farmId: createdFarm.id, cropRotationId: rotation.id, interval: 1 }))
        );
    }

    return createdFarm;
  });
}

export async function getFarmUsers(farmId: string): Promise<User[]> {
  return appDrizzle.select().from(tables.profiles).where(eq(tables.profiles.farmId, farmId));
}

export async function updateFarm(farmId: string, data: Partial<FarmCreateInput>) {
  const { location, ...rest } = data;
  const [updatedFarm] = await appDrizzle
    .update(tables.farms)
    .set({ ...rest, location: location ? sql`ST_GeomFromGeoJSON(${JSON.stringify(location)})` : undefined })
    .where(eq(tables.farms.id, farmId))
    .returning(farmSelectColumns);
  return updatedFarm;
}

export async function deleteFarm(farmId: string) {
  return appDrizzle.delete(tables.farms).where(eq(tables.farms.id, farmId));
}

export async function kickMember(targetUserId: string, callerUserId: string, farmId: string) {
  return appDrizzle.transaction(async (tx) => {
    const farmMembers = await tx.query.profiles.findMany({ where: { farmId } });

    const caller = farmMembers.find((p) => p.id === callerUserId);
    if (!caller || caller.farmRole !== "owner") throw createHttpError(403, "Only farm owners can kick members");

    const target = farmMembers.find((p) => p.id === targetUserId);
    if (!target) throw createHttpError(404, "Member not found in this farm");

    if (target.farmRole === "owner") {
      const ownerCount = farmMembers.filter((p) => p.farmRole === "owner").length;
      if (ownerCount <= 1) throw createHttpError(400, "Cannot remove the only owner");
    }

    await tx.update(tables.profiles).set({ farmId: null, farmRole: null }).where(eq(tables.profiles.id, targetUserId));
  });
}

export async function changeMemberRole(
  targetUserId: string,
  callerId: string,
  farmId: string,
  newRole: "owner" | "member"
) {
  return appDrizzle.transaction(async (tx) => {
    const farmMembers = await tx.query.profiles.findMany({ where: { farmId } });

    const caller = farmMembers.find((p) => p.id === callerId);
    if (!caller || caller.farmRole !== "owner") throw createHttpError(403, "Only farm owners can change member roles");

    const target = farmMembers.find((p) => p.id === targetUserId);
    if (!target) throw createHttpError(404, "Member not found in this farm");

    if (newRole === "member" && target.farmRole === "owner") {
      const ownerCount = farmMembers.filter((p) => p.farmRole === "owner").length;
      if (ownerCount <= 1) throw createHttpError(400, "Cannot demote the only owner");
    }

    const [updatedProfile] = await tx
      .update(tables.profiles)
      .set({ farmRole: newRole })
      .where(eq(tables.profiles.id, targetUserId))
      .returning();
    return updatedProfile;
  });
}
