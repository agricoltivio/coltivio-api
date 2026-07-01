import { and, eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import * as tables from "../db/schema";
import { FarmPermissionFeature, farmPermissionFeatureEnum } from "../db/schema";

export type { FarmPermissionFeature };

export const ALL_PERMISSION_FEATURES = farmPermissionFeatureEnum.enumValues as FarmPermissionFeature[];

export async function getFeatureAccess(
  userId: string,
  feature: FarmPermissionFeature
): Promise<"none" | "read" | "write"> {
  const row = await appDrizzle.query.farmMemberPermissions.findFirst({ where: { userId, feature } });
  return (row?.access as "none" | "read" | "write") ?? "none";
}

export async function listPermissionsForUser(
  userId: string
): Promise<(typeof tables.farmMemberPermissions.$inferSelect)[]> {
  return appDrizzle.query.farmMemberPermissions.findMany({ where: { userId } });
}

export async function initializeMemberPermissions(userId: string, farmId: string): Promise<void> {
  await appDrizzle
    .insert(tables.farmMemberPermissions)
    .values(ALL_PERMISSION_FEATURES.map((feature) => ({ userId, farmId, feature, access: "none" as const })))
    .onConflictDoNothing();
}

export async function setFeatureAccess(
  userId: string,
  farmId: string,
  feature: FarmPermissionFeature,
  access: "none" | "read" | "write"
): Promise<void> {
  await appDrizzle
    .insert(tables.farmMemberPermissions)
    .values({ userId, farmId, feature, access })
    .onConflictDoUpdate({
      target: [tables.farmMemberPermissions.userId, tables.farmMemberPermissions.feature],
      set: { access },
    });
}

export async function resetFeatureAccess(userId: string, feature: FarmPermissionFeature): Promise<void> {
  await appDrizzle
    .delete(tables.farmMemberPermissions)
    .where(and(eq(tables.farmMemberPermissions.userId, userId), eq(tables.farmMemberPermissions.feature, feature)));
}
