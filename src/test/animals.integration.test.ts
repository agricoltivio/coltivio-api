import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, getAdminDb, request } from "./helpers";
import * as schema from "../db/schema";
import { createUserWithFarm, createAnimal, createHerd, createOutdoorSchedule } from "./test-utils";

// ---------------------------------------------------------------------------
// Animals CRUD
// ---------------------------------------------------------------------------
describe("Animals CRUD", () => {
  beforeEach(cleanDb);

  it("creates an animal and retrieves it by id", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      name: "Daisy",
      type: "cow",
      sex: "female",
      dateOfBirth: "2022-03-10",
      usage: "milk",
      registered: true,
    });

    expect(animal.name).toBe("Daisy");
    expect(animal.type).toBe("cow");
    expect(animal.sex).toBe("female");
    expect(animal.farmId).toBe(farmId);
    expect(animal.usage).toBe("milk");

    // Verify DB
    const db = getAdminDb();
    const dbAnimal = await db.query.animals.findFirst({
      where: { id: animal.id },
    });
    expect(dbAnimal!.name).toBe("Daisy");
    expect(dbAnimal!.type).toBe("cow");
    expect(dbAnimal!.sex).toBe("female");
    expect(dbAnimal!.usage).toBe("milk");
    expect(dbAnimal!.registered).toBe(true);
    expect(dbAnimal!.farmId).toBe(farmId);

    // GET by id
    const getRes = await request("GET", `/v1/animals/byId/${animal.id}`, undefined, jwt);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as {
      data: {
        id: string;
        mother: unknown | null;
        father: unknown | null;
        childrenAsMother: unknown[];
        childrenAsFather: unknown[];
      };
    };
    expect(getBody.data.id).toBe(animal.id);
    expect(getBody.data.mother).toBeNull();
    expect(getBody.data.childrenAsMother).toEqual([]);
  });

  it("lists animals for farm with count", async () => {
    const { jwt } = await createUserWithFarm();
    await createAnimal(jwt, { name: "A1" });
    await createAnimal(jwt, { name: "A2" });

    const res = await request("GET", "/v1/animals", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: Array<{ milkAndMeatUsable?: boolean }>; count: number };
    };
    expect(body.data.count).toBe(2);
    expect(body.data.result).toHaveLength(2);
    expect(body.data.result[0].milkAndMeatUsable).toBeDefined();
  });

  it("filters animals by single type (string→array preprocessing)", async () => {
    const { jwt } = await createUserWithFarm();
    await createAnimal(jwt, { name: "Cow1", type: "cow" });
    await createAnimal(jwt, { name: "Goat1", type: "goat" });

    // Single value: query string sends it as a plain string, preprocess wraps it
    const res = await request("GET", "/v1/animals?animalTypes=cow", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: Array<{ type: string }>; count: number };
    };
    expect(body.data.count).toBe(1);
    expect(body.data.result[0].type).toBe("cow");
  });

  it("filters animals by multiple types", async () => {
    const { jwt } = await createUserWithFarm();
    await createAnimal(jwt, { name: "Cow1", type: "cow" });
    await createAnimal(jwt, { name: "Goat1", type: "goat" });
    await createAnimal(jwt, { name: "Sheep1", type: "sheep" });

    const res = await request("GET", "/v1/animals?animalTypes=cow&animalTypes=goat", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: Array<{ type: string }>; count: number };
    };
    expect(body.data.count).toBe(2);
    const types = body.data.result.map((a) => a.type);
    expect(types).toContain("cow");
    expect(types).toContain("goat");
  });

  it("filters out dead animals with onlyLiving=true", async () => {
    const { jwt } = await createUserWithFarm();
    await createAnimal(jwt, { name: "Alive" });
    await createAnimal(jwt, {
      name: "Dead",
      dateOfDeath: "2024-06-01",
      deathReason: "died",
    });

    // onlyLiving defaults to true
    const res = await request("GET", "/v1/animals", undefined, jwt);
    const body = (await res.json()) as {
      data: { result: Array<{ name: string }>; count: number };
    };
    expect(body.data.count).toBe(1);
    expect(body.data.result[0].name).toBe("Alive");

    // onlyLiving=false shows all
    const allRes = await request("GET", "/v1/animals?onlyLiving=false", undefined, jwt);
    const allBody = (await allRes.json()) as {
      data: { result: unknown[]; count: number };
    };
    expect(allBody.data.count).toBe(2);
  });

  it("updates an animal", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, { name: "OldName", usage: "milk" });

    const res = await request("PATCH", `/v1/animals/byId/${animal.id}`, { name: "NewName", usage: "other" }, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string; usage: string } };
    expect(body.data.name).toBe("NewName");
    expect(body.data.usage).toBe("other");

    // Verify DB
    const db = getAdminDb();
    const dbAnimal = await db.query.animals.findFirst({
      where: { id: animal.id },
    });
    expect(dbAnimal!.name).toBe("NewName");
    expect(dbAnimal!.usage).toBe("other");
  });

  it("deletes a single animal", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt);

    const res = await request("DELETE", `/v1/animals/byId/${animal.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbAnimal = await db.query.animals.findFirst({
      where: { id: animal.id },
    });
    expect(dbAnimal).toBeUndefined();
  });

  it("batch deletes multiple animals", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "D1" });
    const a2 = await createAnimal(jwt, { name: "D2" });
    const keep = await createAnimal(jwt, { name: "Keep" });

    const qs = `animalIds=${a1.id}&animalIds=${a2.id}`;
    const res = await request("DELETE", `/v1/animals?${qs}`, undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const remaining = await db.query.animals.findMany({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep.id);
  });

  it("batch updates multiple animals", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "B1", usage: "milk" });
    const a2 = await createAnimal(jwt, { name: "B2", usage: "milk" });

    const res = await request(
      "PATCH",
      "/v1/animals/batch",
      { animalIds: [a1.id, a2.id], data: { usage: "other" } },
      jwt
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbAnimals = await db.query.animals.findMany({
      where: { id: { in: [a1.id, a2.id] } },
    });
    expect(dbAnimals).toHaveLength(2);
    expect(dbAnimals.every((a) => a.usage === "other")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parent-child relationships
// ---------------------------------------------------------------------------
describe("Animal parent-child relationships", () => {
  beforeEach(cleanDb);

  it("sets mother/father and retrieves children", async () => {
    const { jwt } = await createUserWithFarm();
    const mother = await createAnimal(jwt, { name: "Mother", sex: "female" });
    const father = await createAnimal(jwt, { name: "Father", sex: "male" });
    const calf = await createAnimal(jwt, {
      name: "Calf",
      dateOfBirth: "2024-06-01",
      motherId: mother.id,
      fatherId: father.id,
    });

    // Verify DB
    const db = getAdminDb();
    const dbCalf = await db.query.animals.findFirst({
      where: { id: calf.id },
    });
    expect(dbCalf!.motherId).toBe(mother.id);
    expect(dbCalf!.fatherId).toBe(father.id);

    // Verify via API - GET by id
    const calfRes = await request("GET", `/v1/animals/byId/${calf.id}`, undefined, jwt);
    const calfBody = (await calfRes.json()) as {
      data: { mother: { id: string } | null; father: { id: string } | null };
    };
    expect(calfBody.data.mother!.id).toBe(mother.id);
    expect(calfBody.data.father!.id).toBe(father.id);

    // Children of mother
    const childrenRes = await request("GET", `/v1/animals/byId/${mother.id}/children`, undefined, jwt);
    expect(childrenRes.status).toBe(200);
    const childrenBody = (await childrenRes.json()) as {
      data: { result: Array<{ id: string }>; count: number };
    };
    expect(childrenBody.data.count).toBe(1);
    expect(childrenBody.data.result[0].id).toBe(calf.id);

    // Children of father
    const fatherChildrenRes = await request("GET", `/v1/animals/byId/${father.id}/children`, undefined, jwt);
    const fatherChildrenBody = (await fatherChildrenRes.json()) as {
      data: { count: number };
    };
    expect(fatherChildrenBody.data.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Herds CRUD
// ---------------------------------------------------------------------------
describe("Herds CRUD", () => {
  beforeEach(cleanDb);

  it("creates a herd with animals and retrieves it", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "H1" });
    const a2 = await createAnimal(jwt, { name: "H2" });
    const herd = await createHerd(jwt, {
      name: "Pasture Herd",
      animalIds: [a1.id, a2.id],
    });

    expect(herd.name).toBe("Pasture Herd");

    // Verify DB
    const db = getAdminDb();
    const dbHerd = await db.query.herds.findFirst({
      where: { id: herd.id },
    });
    expect(dbHerd!.name).toBe("Pasture Herd");
    expect(dbHerd!.farmId).toBe(farmId);

    // Verify animals got herdId in DB
    const dbAnimals = await db.query.animals.findMany({
      where: { id: { in: [a1.id, a2.id] } },
    });
    expect(dbAnimals.every((a) => a.herdId === herd.id)).toBe(true);

    // GET by id includes animals
    const getRes = await request("GET", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as {
      data: { animals: unknown[] };
    };
    expect(getBody.data.animals).toHaveLength(2);
  });

  it("lists herds for farm", async () => {
    const { jwt } = await createUserWithFarm();
    await createHerd(jwt, { name: "Herd A" });
    await createHerd(jwt, { name: "Herd B" });

    const res = await request("GET", "/v1/animals/herds", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(2);
  });

  it("updates a herd name and animal assignments", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "OrigAnimal" });
    const a2 = await createAnimal(jwt, { name: "NewAnimal" });
    const herd = await createHerd(jwt, { name: "OldName", animalIds: [a1.id] });

    const res = await request(
      "PATCH",
      `/v1/animals/herds/byId/${herd.id}`,
      { name: "NewName", animalIds: [a2.id] },
      jwt
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbHerd = await db.query.herds.findFirst({
      where: { id: herd.id },
    });
    expect(dbHerd!.name).toBe("NewName");

    const dbA1 = await db.query.animals.findFirst({
      where: { id: a1.id },
    });
    expect(dbA1!.herdId).toBeNull();
    const dbA2 = await db.query.animals.findFirst({
      where: { id: a2.id },
    });
    expect(dbA2!.herdId).toBe(herd.id);
  });

  it("deletes a herd", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, { name: "ToDelete" });

    const res = await request("DELETE", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbHerd = await db.query.herds.findFirst({
      where: { id: herd.id },
    });
    expect(dbHerd).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Herds with inline outdoor schedules
// ---------------------------------------------------------------------------
describe("Herds with inline outdoor schedules", () => {
  beforeEach(cleanDb);

  it("creates a herd with outdoor schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, {
      name: "ScheduleHerd",
      outdoorSchedules: [
        { startDate: "2025-05-01", endDate: "2025-06-30", type: "pasture" },
        { startDate: "2025-07-01", endDate: "2025-09-30", type: "exercise_yard" },
      ],
    });

    // Verify DB
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(2);

    // Verify API response
    const res = await request("GET", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { outdoorSchedules: Array<{ type: string }> };
    };
    expect(body.data.outdoorSchedules).toHaveLength(2);
  });

  it("creates a herd with outdoor schedules including recurrence", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, {
      name: "RecurHerd",
      outdoorSchedules: [
        {
          startDate: "2025-05-01",
          endDate: "2025-05-01",
          type: "exercise_yard",
          recurrence: {
            frequency: "weekly",
            interval: 1,
            byWeekday: ["MO", "WE", "FR"],
            until: "2025-09-30",
          },
        },
      ],
    });

    // Verify DB
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(1);
    const dbRecurrences = await db.query.outdoorScheduleRecurrences.findMany({
      where: { outdoorScheduleId: dbSchedules[0].id },
    });
    expect(dbRecurrences).toHaveLength(1);
    expect(dbRecurrences[0].frequency).toBe("weekly");

    // Verify API response
    const res = await request("GET", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { outdoorSchedules: Array<{ recurrence: Record<string, unknown> | null }> };
    };
    expect(body.data.outdoorSchedules).toHaveLength(1);
    expect(body.data.outdoorSchedules[0].recurrence).not.toBeNull();
  });

  it("rejects createHerd with overlapping inline schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await request(
      "POST",
      "/v1/animals/herds",
      {
        name: "OverlapHerd",
        animalIds: [],
        outdoorSchedules: [
          { startDate: "2025-05-01", endDate: "2025-08-31", type: "pasture" },
          { startDate: "2025-07-01", endDate: "2025-09-30", type: "exercise_yard" },
        ],
      },
      jwt
    );
    expect(res.status).toBe(409);

    // Verify nothing was created in DB
    const db = getAdminDb();
    const dbHerds = await db.query.herds.findMany({});
    expect(dbHerds).toHaveLength(0);
  });

  it("updateHerd replaces outdoor schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, {
      name: "ReplaceHerd",
      outdoorSchedules: [{ startDate: "2025-05-01", endDate: "2025-09-30", type: "pasture" }],
    });

    // Replace with two new schedules
    const patchRes = await request(
      "PATCH",
      `/v1/animals/herds/byId/${herd.id}`,
      {
        outdoorSchedules: [
          { startDate: "2025-05-01", endDate: "2025-06-30", type: "exercise_yard" },
          { startDate: "2025-07-01", endDate: "2025-09-30", type: "pasture" },
        ],
      },
      jwt
    );
    expect(patchRes.status).toBe(200);

    // Verify DB — old schedule gone, two new ones exist
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(2);

    // Verify API response
    const res = await request("GET", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    const body = (await res.json()) as {
      data: { outdoorSchedules: Array<{ type: string }> };
    };
    expect(body.data.outdoorSchedules).toHaveLength(2);
  });

  it("updateHerd with empty outdoorSchedules removes all schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, {
      name: "ClearHerd",
      outdoorSchedules: [{ startDate: "2025-05-01", endDate: "2025-09-30", type: "pasture" }],
    });

    const patchRes = await request("PATCH", `/v1/animals/herds/byId/${herd.id}`, { outdoorSchedules: [] }, jwt);
    expect(patchRes.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(0);
  });

  it("rejects updateHerd with overlapping replacement schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, { name: "OverlapUpdate" });

    const res = await request(
      "PATCH",
      `/v1/animals/herds/byId/${herd.id}`,
      {
        outdoorSchedules: [
          { startDate: "2025-05-01", endDate: "2025-08-31", type: "pasture" },
          { startDate: "2025-07-01", endDate: "2025-09-30", type: "exercise_yard" },
        ],
      },
      jwt
    );
    expect(res.status).toBe(409);

    // Verify DB unchanged (no schedules created)
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(0);
  });

  it("updateHerd without outdoorSchedules leaves existing schedules untouched", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, {
      name: "KeepSchedules",
      outdoorSchedules: [{ startDate: "2025-05-01", endDate: "2025-09-30", type: "pasture" }],
    });

    // Update only the name
    const patchRes = await request("PATCH", `/v1/animals/herds/byId/${herd.id}`, { name: "Renamed" }, jwt);
    expect(patchRes.status).toBe(200);

    // Verify DB — schedule still exists
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(1);

    // Verify API response
    const res = await request("GET", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    const body = (await res.json()) as {
      data: { name: string; outdoorSchedules: unknown[] };
    };
    expect(body.data.name).toBe("Renamed");
    expect(body.data.outdoorSchedules).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Outdoor Schedules CRUD
// ---------------------------------------------------------------------------
describe("Outdoor Schedules CRUD", () => {
  beforeEach(cleanDb);

  it("creates a schedule without recurrence", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, { name: "OutdoorHerd" });

    const schedule = await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2025-05-01",
      endDate: "2025-09-30",
      type: "pasture",
    });
    expect(schedule.herdId).toBe(herd.id);
    expect(schedule.type).toBe("pasture");
    expect(schedule.recurrence).toBeNull();

    // Verify DB
    const db = getAdminDb();
    const dbSchedule = await db.query.outdoorSchedules.findFirst({
      where: { id: schedule.id },
    });
    expect(dbSchedule!.herdId).toBe(herd.id);
    expect(dbSchedule!.type).toBe("pasture");
  });

  it("creates a schedule with weekly recurrence", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt, { name: "RecurHerd" });

    const schedule = await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2025-05-01",
      endDate: "2025-05-01",
      type: "exercise_yard",
      recurrence: {
        frequency: "weekly",
        interval: 1,
        byWeekday: ["MO", "WE", "FR"],
      },
    });
    expect(schedule.recurrence).not.toBeNull();
    const rec = schedule.recurrence as Record<string, unknown>;
    expect(rec.frequency).toBe("weekly");
    expect(rec.byWeekday).toEqual(["MO", "WE", "FR"]);

    // Verify DB
    const db = getAdminDb();
    const dbSchedule = await db.query.outdoorSchedules.findFirst({
      where: { id: schedule.id },
    });
    expect(dbSchedule).toBeDefined();
    const dbRecurrences = await db.query.outdoorScheduleRecurrences.findMany({
      where: { outdoorScheduleId: schedule.id },
    });
    expect(dbRecurrences).toHaveLength(1);
    expect(dbRecurrences[0].frequency).toBe("weekly");
  });

  it("updates a schedule", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt);
    const schedule = await createOutdoorSchedule(jwt, herd.id);

    const res = await request(
      "PATCH",
      `/v1/animals/herds/outdoorSchedules/byId/${schedule.id}`,
      { type: "exercise_yard", notes: "Updated notes" },
      jwt
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbSchedule = await db.query.outdoorSchedules.findFirst({
      where: { id: schedule.id },
    });
    expect(dbSchedule!.type).toBe("exercise_yard");
    expect(dbSchedule!.notes).toBe("Updated notes");
  });

  it("deletes a schedule", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt);
    const schedule = await createOutdoorSchedule(jwt, herd.id);

    const res = await request("DELETE", `/v1/animals/herds/outdoorSchedules/byId/${schedule.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbSchedule = await db.query.outdoorSchedules.findFirst({
      where: { id: schedule.id },
    });
    expect(dbSchedule).toBeUndefined();
  });

  it("rejects overlapping schedules for the same herd", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt);
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2025-05-01",
      endDate: "2025-09-30",
    });

    // Overlapping range should fail
    const res = await request(
      "POST",
      `/v1/animals/herds/byId/${herd.id}/outdoorSchedules`,
      { startDate: "2025-08-01", endDate: "2025-10-31", type: "pasture" },
      jwt
    );
    expect(res.status).toBe(409);

    // Verify DB: still only one schedule
    const db = getAdminDb();
    const dbSchedules = await db.query.outdoorSchedules.findMany({
      where: { herdId: herd.id },
    });
    expect(dbSchedules).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Outdoor Journal
// ---------------------------------------------------------------------------
describe("Outdoor Journal", () => {
  beforeEach(cleanDb);

  it("returns journal entries for animals in a herd with outdoor schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const sheep = await createAnimal(jwt, {
      name: "OldSheep",
      type: "sheep",
      sex: "female",
      dateOfBirth: "2020-01-01",
      usage: "other",
    });
    const herd = await createHerd(jwt, { animalIds: [sheep.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: Array<{ category: string; animalCount: number }>;
        uncategorizedAnimals: Array<{ id: string; name: string; earTag: unknown }>;
      };
    };
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
    expect(body.data.entries[0].category).toBe("D1");
    expect(body.data.entries[0].animalCount).toBe(1);
    expect(body.data.uncategorizedAnimals).toHaveLength(0);
  });

  it("counts uncategorized animals (e.g. pigs)", async () => {
    const { jwt } = await createUserWithFarm();
    const pig = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });
    const herd = await createHerd(jwt, { animalIds: [pig.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { entries: unknown[]; uncategorizedAnimals: Array<{ id: string; name: string }> };
    };
    expect(body.data.entries).toHaveLength(0);
    expect(body.data.uncategorizedAnimals).toHaveLength(1);
    expect(body.data.uncategorizedAnimals[0].id).toBe(pig.id);
  });

  it("returns empty when no herds have outdoor schedules", async () => {
    const { jwt } = await createUserWithFarm();
    await createAnimal(jwt);

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { entries: unknown[]; uncategorizedAnimals: unknown[] };
    };
    expect(body.data.entries).toHaveLength(0);
    expect(body.data.uncategorizedAnimals).toHaveLength(0);
  });

  it("pig alongside categorized sheep both appear correctly", async () => {
    const { jwt } = await createUserWithFarm();
    const sheep = await createAnimal(jwt, {
      name: "OldSheep",
      type: "sheep",
      sex: "female",
      dateOfBirth: "2020-01-01",
      usage: "other",
    });
    const pig = await createAnimal(jwt, {
      name: "Piggy",
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });
    const herd = await createHerd(jwt, { animalIds: [sheep.id, pig.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: Array<{ category: string; animalCount: number }>;
        uncategorizedAnimals: Array<{ id: string; name: string }>;
      };
    };
    // Sheep should produce a D1 entry
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
    expect(body.data.entries[0].category).toBe("D1");
    // Pig should be uncategorized
    expect(body.data.uncategorizedAnimals).toHaveLength(1);
    expect(body.data.uncategorizedAnimals[0].id).toBe(pig.id);
  });

  it("pig added to existing herd via updateHerd shows as uncategorized", async () => {
    const { jwt } = await createUserWithFarm();
    const pig = await createAnimal(jwt, {
      name: "LatePig",
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });
    // Create herd without the pig, add schedule, then add pig via updateHerd
    const herd = await createHerd(jwt);
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });
    await request("PATCH", `/v1/animals/herds/byId/${herd.id}`, { animalIds: [pig.id] }, jwt);

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: unknown[];
        uncategorizedAnimals: Array<{ id: string }>;
      };
    };
    expect(body.data.entries).toHaveLength(0);
    expect(body.data.uncategorizedAnimals).toHaveLength(1);
    expect(body.data.uncategorizedAnimals[0].id).toBe(pig.id);
  });

  it("pig added via updateAnimal herdId (no membership) shows as uncategorized", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt);
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });
    // Create pig, then set herdId directly via updateAnimal (bypasses membership creation)
    const pig = await createAnimal(jwt, {
      name: "DirectPig",
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });
    await request("PATCH", `/v1/animals/byId/${pig.id}`, { herdId: herd.id }, jwt);

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: unknown[];
        uncategorizedAnimals: Array<{ id: string }>;
      };
    };
    expect(body.data.entries).toHaveLength(0);
    expect(body.data.uncategorizedAnimals).toHaveLength(1);
    expect(body.data.uncategorizedAnimals[0].id).toBe(pig.id);
  });

  it("splits journal entries when animal changes category mid-schedule", async () => {
    const { jwt } = await createUserWithFarm();
    // Female sheep born 2026-07-01 → turns 365 days on ~2027-07-01 (D3 → D1)
    const youngSheep = await createAnimal(jwt, {
      type: "sheep",
      sex: "female",
      dateOfBirth: "2026-07-01",
      usage: "other",
    });
    const herd = await createHerd(jwt, { animalIds: [youngSheep.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { entries: Array<{ category: string }> };
    };
    const categories = body.data.entries.map((e) => e.category);
    expect(categories).toContain("D3");
    expect(categories).toContain("D1");
  });
});

// ---------------------------------------------------------------------------
// Custom Outdoor Journal Categories
// ---------------------------------------------------------------------------
describe("Custom Outdoor Journal Categories", () => {
  beforeEach(cleanDb);

  it("sets custom categories for an animal and verifies DB", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });

    const res = await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [
          { startDate: "2027-05-01", endDate: "2027-06-30", category: "A1" },
          { startDate: "2027-07-01", endDate: "2027-09-30", category: "A2" },
        ],
      },
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: Array<{ id: string; category: string; animalId: string }> };
    };
    expect(body.data.result).toHaveLength(2);
    expect(body.data.result.map((c) => c.category).sort()).toEqual(["A1", "A2"]);
    expect(body.data.result.every((c) => c.animalId === animal.id)).toBe(true);

    // Verify DB
    const db = getAdminDb();
    const dbCategories = await db.query.customOutdoorJournalCategories.findMany({
      where: { animalId: animal.id },
    });
    expect(dbCategories).toHaveLength(2);
    expect(dbCategories.map((c) => c.category).sort()).toEqual(["A1", "A2"]);
  });

  it("replaces existing custom categories on subsequent call", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      usage: "other",
    });

    // Set initial categories
    await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [{ startDate: "2027-05-01", endDate: "2027-09-30", category: "A1" }],
      },
      jwt
    );

    // Replace with new ones
    const res = await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [{ startDate: "2027-06-01", endDate: "2027-07-31", category: "D1" }],
      },
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: Array<{ category: string }> };
    };
    expect(body.data.result).toHaveLength(1);
    expect(body.data.result[0].category).toBe("D1");

    // Verify DB — old entries gone, only new one
    const db = getAdminDb();
    const dbCategories = await db.query.customOutdoorJournalCategories.findMany({
      where: { animalId: animal.id },
    });
    expect(dbCategories).toHaveLength(1);
    expect(dbCategories[0].category).toBe("D1");
  });

  it("clears all categories when empty array is passed", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      usage: "other",
    });

    // Set initial
    await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [{ startDate: "2027-05-01", endDate: "2027-09-30", category: "A1" }],
      },
      jwt
    );

    // Clear
    const res = await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      { entries: [] },
      jwt
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbCategories = await db.query.customOutdoorJournalCategories.findMany({
      where: { animalId: animal.id },
    });
    expect(dbCategories).toHaveLength(0);
  });

  it("rejects overlapping custom categories", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      usage: "other",
    });

    const res = await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [
          { startDate: "2027-05-01", endDate: "2027-08-31", category: "A1" },
          { startDate: "2027-07-01", endDate: "2027-09-30", category: "A2" },
        ],
      },
      jwt
    );
    expect(res.status).toBe(409);

    // Verify DB — nothing was created
    const db = getAdminDb();
    const dbCategories = await db.query.customOutdoorJournalCategories.findMany({
      where: { animalId: animal.id },
    });
    expect(dbCategories).toHaveLength(0);
  });

  it("custom categories are included in GET animal by id", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      usage: "other",
    });

    await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [{ startDate: "2027-05-01", endDate: "2027-09-30", category: "A1" }],
      },
      jwt
    );

    const res = await request("GET", `/v1/animals/byId/${animal.id}`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        customOutdoorJournalCategories: Array<{
          id: string;
          category: string;
          animalId: string;
        }>;
      };
    };
    expect(body.data.customOutdoorJournalCategories).toHaveLength(1);
    expect(body.data.customOutdoorJournalCategories[0].category).toBe("A1");
    expect(body.data.customOutdoorJournalCategories[0].animalId).toBe(animal.id);
  });

  it("custom category overrides null age-based category in outdoor journal", async () => {
    const { jwt } = await createUserWithFarm();
    // Pig has no age-based rules → normally uncategorized
    const pig = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });

    // Set a custom category covering the outdoor schedule period
    await request(
      "PUT",
      `/v1/animals/byId/${pig.id}/customOutdoorJournalCategories`,
      {
        entries: [{ startDate: "2027-01-01", endDate: "2027-12-31", category: "D1" }],
      },
      jwt
    );

    const herd = await createHerd(jwt, { animalIds: [pig.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: Array<{ category: string; animalCount: number }>;
        uncategorizedAnimals: unknown[];
      };
    };
    expect(body.data.uncategorizedAnimals).toHaveLength(0);
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
    expect(body.data.entries[0].category).toBe("D1");
    expect(body.data.entries[0].animalCount).toBe(1);
  });

  it("pig without custom category remains uncategorized in outdoor journal", async () => {
    const { jwt } = await createUserWithFarm();
    const pig = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      dateOfBirth: "2024-01-01",
      usage: "other",
    });

    const herd = await createHerd(jwt, { animalIds: [pig.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2027-05-01",
      endDate: "2027-09-30",
    });

    const res = await request(
      "GET",
      "/v1/animals/outdoorJournal?fromDate=2027-01-01&toDate=2027-12-31",
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: unknown[];
        uncategorizedAnimals: Array<{ id: string }>;
      };
    };
    expect(body.data.entries).toHaveLength(0);
    expect(body.data.uncategorizedAnimals).toHaveLength(1);
    expect(body.data.uncategorizedAnimals[0].id).toBe(pig.id);
  });

  it("deleting animal cascades to custom categories", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, {
      type: "pig",
      sex: "female",
      usage: "other",
    });

    await request(
      "PUT",
      `/v1/animals/byId/${animal.id}/customOutdoorJournalCategories`,
      {
        entries: [{ startDate: "2027-05-01", endDate: "2027-09-30", category: "A1" }],
      },
      jwt
    );

    // Delete the animal
    await request("DELETE", `/v1/animals/byId/${animal.id}`, undefined, jwt);

    // Verify DB — custom categories cascaded
    const db = getAdminDb();
    const dbCategories = await db.query.customOutdoorJournalCategories.findMany({
      where: { animalId: animal.id },
    });
    expect(dbCategories).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Herd detail includes outdoor schedules
// ---------------------------------------------------------------------------
describe("Herd detail includes outdoor schedules", () => {
  beforeEach(cleanDb);

  it("GET herd by id includes associated outdoor schedules", async () => {
    const { jwt } = await createUserWithFarm();
    const herd = await createHerd(jwt);
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2025-06-01",
      endDate: "2025-08-31",
      type: "pasture",
    });

    const res = await request("GET", `/v1/animals/herds/byId/${herd.id}`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { outdoorSchedules: Array<{ type: string }> };
    };
    expect(body.data.outdoorSchedules).toHaveLength(1);
    expect(body.data.outdoorSchedules[0].type).toBe("pasture");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe("Animals input validation", () => {
  beforeEach(cleanDb);

  it("rejects invalid animal type", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await request(
      "POST",
      "/v1/animals",
      {
        name: "Bad",
        type: "dragon",
        sex: "female",
        dateOfBirth: "2020-01-01",
        registered: true,
        usage: "other",
      },
      jwt
    );
    expect(res.status).toBe(400);

    // Verify nothing was created in DB
    const db = getAdminDb();
    const dbAnimals = await db.query.animals.findMany({});
    expect(dbAnimals).toHaveLength(0);
  });

  it("rejects missing required fields", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await request("POST", "/v1/animals", { name: "Incomplete" }, jwt);
    expect(res.status).toBe(400);

    // Verify nothing was created in DB
    const db = getAdminDb();
    const dbAnimals = await db.query.animals.findMany({});
    expect(dbAnimals).toHaveLength(0);
  });

  it("rejects invalid sex", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await request(
      "POST",
      "/v1/animals",
      {
        name: "Bad",
        type: "cow",
        sex: "unknown",
        dateOfBirth: "2020-01-01",
        registered: true,
        usage: "milk",
      },
      jwt
    );
    expect(res.status).toBe(400);

    // Verify nothing was created in DB
    const db = getAdminDb();
    const dbAnimals = await db.query.animals.findMany({});
    expect(dbAnimals).toHaveLength(0);
  });
});
