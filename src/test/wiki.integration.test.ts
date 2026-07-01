import { describe, it, expect, beforeEach } from "@jest/globals";
import { cleanDb, createTestUser, getAdminDb, request } from "./helpers";
import { createUserWithFarm, createFarmMember } from "./test-utils";
import { wikiCategories, wikiCategoryTranslations } from "../db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCategory() {
  const db = getAdminDb();
  const [cat] = await db.insert(wikiCategories).values({ slug: "plants" }).returning();
  await db.insert(wikiCategoryTranslations).values({ categoryId: cat.id, locale: "en", name: "Plants" });
  return cat;
}

async function createEntry(jwt: string, categoryId: string) {
  const res = await request(
    "POST",
    "/v1/wiki",
    { categoryId, translations: [{ locale: "en", title: "", body: "" }] },
    jwt
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: { id: string; status: string } };
  return body.data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Wiki — entry lifecycle", () => {
  beforeEach(cleanDb);

  it("creates a draft entry", async () => {
    const { jwt, userId, farmId } = await createUserWithFarm({});
    const cat = await seedCategory();

    const entry = await createEntry(jwt, cat.id);

    expect(entry.status).toBe("draft");

    const db = getAdminDb();
    const dbEntry = await db.query.wikiEntries.findFirst({ where: { id: entry.id } });
    expect(dbEntry!.status).toBe("draft");
    expect(dbEntry!.createdBy).toBe(userId);
    expect(dbEntry!.farmId).toBe(farmId);
  });

  it("farm member can see a farm-scoped entry created by the owner", async () => {
    const { jwt: ownerJwt, farmId } = await createUserWithFarm({});
    const { jwt: memberJwt } = await createFarmMember(farmId, "member@test.com");
    const cat = await seedCategory();

    const res = await request(
      "POST",
      "/v1/wiki",
      { categoryId: cat.id, translations: [{ locale: "en", title: "Farm Guide", body: "Content." }] },
      ownerJwt
    );
    expect(res.status).toBe(200);

    const listRes = await request("GET", "/v1/wiki/myEntries", undefined, memberJwt);
    expect(listRes.status).toBe(200);
    const body = (await listRes.json()) as { data: { result: Array<{ id: string }>; count: number } };
    expect(body.data.count).toBe(1);
  });

  it("farm member can edit an entry created by the owner", async () => {
    const { jwt: ownerJwt, farmId } = await createUserWithFarm({});
    const { jwt: memberJwt } = await createFarmMember(farmId, "member@test.com");
    const cat = await seedCategory();

    const entry = await createEntry(ownerJwt, cat.id);

    const updateRes = await request(
      "PATCH",
      `/v1/wiki/byId/${entry.id}`,
      { translations: [{ locale: "en", title: "Updated by Member", body: "Updated content." }] },
      memberJwt
    );
    expect(updateRes.status).toBe(200);

    const db = getAdminDb();
    const dbTranslations = await db.query.wikiEntryTranslations.findMany({ where: { entryId: entry.id } });
    expect(dbTranslations[0].title).toBe("Updated by Member");
  });

  it("user without a farm cannot create wiki entries", async () => {
    const { jwt } = await createTestUser("noFarm@test.com", "password123");
    const cat = await seedCategory();

    const res = await request(
      "POST",
      "/v1/wiki",
      { categoryId: cat.id, translations: [{ locale: "en", title: "Test", body: "" }] },
      jwt
    );
    expect(res.status).toBe(400);
  });

  it("getFarmEntries returns all farm entries", async () => {
    const { jwt } = await createUserWithFarm({});
    const cat = await seedCategory();

    await createEntry(jwt, cat.id);

    const res = await request("GET", "/v1/wiki/myEntries", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { result: Array<{ status: string }>; count: number } };
    expect(body.data.count).toBe(1);
    expect(body.data.result[0].status).toBe("draft");
  });
});
