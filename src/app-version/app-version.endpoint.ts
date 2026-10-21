import { and, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { adminDrizzle } from "../db/db";
import { appReleases } from "../db/schema";
import { publicEndpointFactory } from "../endpoint-factory";

type Platform = "ios" | "android";

const platformReleaseSchema = z
  .object({
    version: z.string(),
    minSupportedVersion: z.string().nullable(),
    releasedAt: z.date(),
  })
  .nullable();

async function latestRelease(platform: Platform) {
  const [row] = await adminDrizzle
    .select({
      version: appReleases.version,
      minSupportedVersion: appReleases.minSupportedVersion,
      releasedAt: appReleases.releasedAt,
    })
    .from(appReleases)
    .where(and(eq(appReleases.platform, platform), lte(appReleases.releasedAt, new Date())))
    .orderBy(desc(appReleases.releasedAt), desc(appReleases.createdAt))
    .limit(1);
  return row ?? null;
}

// Empty table answers with nulls rather than 404: the app calls this on every
// launch and its fetch middleware treats any non-2xx as an error.
export const getAppVersionEndpoint = publicEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({ ios: platformReleaseSchema, android: platformReleaseSchema }),
  handler: async () => {
    const [ios, android] = await Promise.all([latestRelease("ios"), latestRelease("android")]);
    return { ios, android };
  },
});
