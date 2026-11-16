import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, getAdminDb, request } from "./helpers";
import * as schema from "../db/schema";
import { createUserWithFarm, createAnimal, createTreatment, createDrug } from "./test-utils";

// ---------------------------------------------------------------------------
// Treatments CRUD
// ---------------------------------------------------------------------------
describe("Treatments CRUD", () => {
  beforeEach(cleanDb);

  it("creates a treatment and retrieves it by id", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const animal = await createAnimal(jwt, { name: "SickCow" });
    const treatment = await createTreatment(jwt, [animal.id], {
      name: "Vaccination",
      startDate: "2025-02-01",
      endDate: "2025-02-03",
      criticalAntibiotic: false,
      antibiogramAvailable: true,
    });

    expect(treatment.name).toBe("Vaccination");
    expect(treatment.farmId).toBe(farmId);
    expect(treatment.criticalAntibiotic).toBe(false);
    expect(treatment.antibiogramAvailable).toBe(true);

    // Verify DB
    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({
      where: { id: treatment.id },
    });
    expect(dbTreatment!.name).toBe("Vaccination");
    expect(dbTreatment!.farmId).toBe(farmId);
    expect(dbTreatment!.criticalAntibiotic).toBe(false);
    expect(dbTreatment!.antibiogramAvailable).toBe(true);

    // GET by id includes animals
    const getRes = await request("GET", `/v1/treatments/byId/${treatment.id}`, undefined, jwt);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as {
      data: { id: string; animals: Array<{ id: string }> };
    };
    expect(getBody.data.id).toBe(treatment.id);
    expect(getBody.data.animals).toHaveLength(1);
    expect(getBody.data.animals[0].id).toBe(animal.id);
  });

  it("lists treatments for farm", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "Cow1" });
    const a2 = await createAnimal(jwt, { name: "Cow2" });
    await createTreatment(jwt, [a1.id], { name: "T1" });
    await createTreatment(jwt, [a2.id], { name: "T2" });

    const res = await request("GET", "/v1/treatments", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(2);
  });

  it("creates treatment for multiple animals", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "Cow1" });
    const a2 = await createAnimal(jwt, { name: "Cow2" });
    const treatment = await createTreatment(jwt, [a1.id, a2.id], {
      name: "Group Treatment",
    });

    // GET by id to verify both animals
    const getRes = await request("GET", `/v1/treatments/byId/${treatment.id}`, undefined, jwt);
    const getBody = (await getRes.json()) as {
      data: { animals: Array<{ id: string }> };
    };
    expect(getBody.data.animals).toHaveLength(2);
  });

  it("creates treatment with drug reference and marks drug in use", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt);
    const drug = await createDrug(jwt, { name: "Antibiotic X" });
    const treatment = await createTreatment(jwt, [animal.id], {
      name: "Drug Treatment",
      drugId: drug.id,
    });

    // Verify DB
    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({
      where: { id: treatment.id },
    });
    expect(dbTreatment!.drugId).toBe(drug.id);

    // Drug should now be in use
    const inUseRes = await request("GET", `/v1/drugs/byId/${drug.id}/inUse`, undefined, jwt);
    const inUseBody = (await inUseRes.json()) as { data: { inUse: boolean } };
    expect(inUseBody.data.inUse).toBe(true);
  });

  it("creates a treatment with a drug not defined for the animal type, without usable dates", async () => {
    const { jwt } = await createUserWithFarm();
    // The default drug only has waiting times for cows
    const goat = await createAnimal(jwt, { name: "Goaty", type: "goat" });
    const drug = await createDrug(jwt, { name: "Cow Only Drug" });

    const treatment = await createTreatment(jwt, [goat.id], {
      name: "Off-label",
      drugId: drug.id,
    });

    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({
      where: { id: treatment.id },
    });
    expect(dbTreatment!.drugId).toBe(drug.id);
    expect(dbTreatment!.milkUsableDate).toBeNull();
    expect(dbTreatment!.meatUsableDate).toBeNull();
  });

  it("stores the usable dates as sent instead of deriving them from the drug", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt);
    // Default drug: 3 days milk, 14 days meat for cows; the user overrides both
    const drug = await createDrug(jwt);

    const treatment = await createTreatment(jwt, [animal.id], {
      drugId: drug.id,
      endDate: "2025-01-03",
      milkUsableDate: "2025-01-10",
      meatUsableDate: "2025-02-01",
    });

    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({
      where: { id: treatment.id },
    });
    expect(dbTreatment!.milkUsableDate?.toISOString().slice(0, 10)).toBe("2025-01-10");
    expect(dbTreatment!.meatUsableDate?.toISOString().slice(0, 10)).toBe("2025-02-01");
  });

  it("rejects a treatment with animals of different types", async () => {
    const { jwt } = await createUserWithFarm();
    const cow = await createAnimal(jwt, { name: "Cow" });
    const goat = await createAnimal(jwt, { name: "Goat", type: "goat" });

    const res = await request(
      "POST",
      "/v1/treatments",
      {
        name: "Mixed",
        startDate: "2025-01-01",
        endDate: "2025-01-03",
        criticalAntibiotic: false,
        antibiogramAvailable: false,
        animalIds: [cow.id, goat.id],
      },
      jwt
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("treatment_mixed_animal_types");
  });

  it("rejects changing a treatment's animals to different types", async () => {
    const { jwt } = await createUserWithFarm();
    const cow = await createAnimal(jwt, { name: "Cow" });
    const goat = await createAnimal(jwt, { name: "Goat", type: "goat" });
    const treatment = await createTreatment(jwt, [cow.id], { name: "Cow only" });

    const res = await request(
      "PATCH",
      `/v1/treatments/byId/${treatment.id}`,
      { name: "Renamed", animalIds: [cow.id, goat.id] },
      jwt
    );
    expect(res.status).toBe(400);

    // Rolled back: neither the name nor the animals changed
    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({ where: { id: treatment.id } });
    expect(dbTreatment!.name).toBe("Cow only");
    const links = await db.query.animalTreatments.findMany({ where: { treatmentId: treatment.id } });
    expect(links.map((link) => link.animalId)).toEqual([cow.id]);
  });

  it("keeps an older treatment with mixed animal types editable while its animals stay the same", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const cow = await createAnimal(jwt, { name: "Cow" });
    const goat = await createAnimal(jwt, { name: "Goat", type: "goat" });
    // Created before the check existed, so inserted directly
    const db = getAdminDb();
    const [legacyTreatment] = await db
      .insert(schema.treatments)
      .values({
        farmId,
        name: "Legacy mixed",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-03"),
        criticalAntibiotic: false,
        antibiogramAvailable: false,
      })
      .returning();
    await db.insert(schema.animalTreatments).values([
      { farmId, treatmentId: legacyTreatment.id, animalId: cow.id },
      { farmId, treatmentId: legacyTreatment.id, animalId: goat.id },
    ]);

    // Clients send the unchanged animalIds with every edit
    const res = await request(
      "PATCH",
      `/v1/treatments/byId/${legacyTreatment.id}`,
      { name: "Legacy renamed", animalIds: [goat.id, cow.id] },
      jwt
    );
    expect(res.status).toBe(200);
    const dbTreatment = await db.query.treatments.findFirst({ where: { id: legacyTreatment.id } });
    expect(dbTreatment!.name).toBe("Legacy renamed");
  });

  it("updates a treatment", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt);
    const treatment = await createTreatment(jwt, [animal.id], { name: "OldName" });

    const res = await request(
      "PATCH",
      `/v1/treatments/byId/${treatment.id}`,
      { name: "NewName", notes: "Went well" },
      jwt
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({
      where: { id: treatment.id },
    });
    expect(dbTreatment!.name).toBe("NewName");
    expect(dbTreatment!.notes).toBe("Went well");
  });

  it("deletes a treatment", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt);
    const treatment = await createTreatment(jwt, [animal.id]);

    const res = await request("DELETE", `/v1/treatments/byId/${treatment.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbTreatment = await db.query.treatments.findFirst({
      where: { id: treatment.id },
    });
    expect(dbTreatment).toBeUndefined();
  });
});
