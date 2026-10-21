import { beforeEach, describe, expect, it } from "@jest/globals";
import { appReleases } from "../db/schema";
import { cleanDb, getAdminDb, rawRequest } from "./helpers";

type PlatformRelease = { version: string; minSupportedVersion: string | null; releasedAt: string } | null;
type Body = { data: { ios: PlatformRelease; android: PlatformRelease } };

async function getAppVersion(headers?: Record<string, string>) {
  const res = await rawRequest("GET", "/v1/app-version", { headers });
  expect(res.status).toBe(200);
  return ((await res.json()) as Body).data;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe("GET /v1/app-version", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("returns nulls when no release is recorded", async () => {
    expect(await getAppVersion()).toEqual({ ios: null, android: null });
  });

  it("returns only the platforms that have a release", async () => {
    await getAdminDb().insert(appReleases).values({ platform: "ios", version: "1.0.7" });

    const data = await getAppVersion();
    expect(data.android).toBeNull();
    expect(data.ios?.version).toBe("1.0.7");
    expect(data.ios?.minSupportedVersion).toBeNull();
    expect(typeof data.ios?.releasedAt).toBe("string");
    expect(new Date(data.ios!.releasedAt).getTime()).not.toBeNaN();
  });

  it("picks the most recently released row per platform", async () => {
    await getAdminDb()
      .insert(appReleases)
      .values([
        { platform: "ios", version: "1.0.7", releasedAt: daysAgo(10) },
        { platform: "ios", version: "1.0.8", releasedAt: daysAgo(1), minSupportedVersion: "1.0.5" },
        { platform: "android", version: "1.0.7", releasedAt: daysAgo(3) },
      ]);

    const data = await getAppVersion();
    expect(data.ios?.version).toBe("1.0.8");
    expect(data.ios?.minSupportedVersion).toBe("1.0.5");
    expect(data.android?.version).toBe("1.0.7");
  });

  it("ignores releases scheduled in the future", async () => {
    await getAdminDb()
      .insert(appReleases)
      .values([
        { platform: "ios", version: "1.0.7", releasedAt: daysAgo(10) },
        { platform: "ios", version: "1.0.8", releasedAt: daysAgo(-1) },
        { platform: "android", version: "1.0.8", releasedAt: daysAgo(-1) },
      ]);

    const data = await getAppVersion();
    expect(data.ios?.version).toBe("1.0.7");
    expect(data.android).toBeNull();
  });

  it("is public and ignores a bogus authorization header", async () => {
    await getAdminDb().insert(appReleases).values({ platform: "android", version: "1.0.7" });

    const data = await getAppVersion({ Authorization: "Bearer nope" });
    expect(data.android?.version).toBe("1.0.7");
  });
});
