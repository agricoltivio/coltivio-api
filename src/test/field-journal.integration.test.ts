import { describe, it, expect, beforeEach } from "@jest/globals";
import { cleanDb, getAdminDb, request } from "./helpers";
import { createFarmMember, createUserWithFarm, grantMemberWriteAccess } from "./test-utils";
import { fieldJournalImages } from "../db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createJournalEntry(jwt: string, data?: Record<string, unknown>) {
  const res = await request(
    "POST",
    "/v1/farm/fieldJournal",
    { title: "Field observation", date: "2024-06-01", content: "Crops looking healthy.", ...data },
    jwt
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Field Journal — entry CRUD", () => {
  beforeEach(cleanDb);

  it("creates a journal entry", async () => {
    const { jwt, farmId } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });

    const res = await request(
      "POST",
      "/v1/farm/fieldJournal",
      { title: "Soil check", date: "2024-06-01", content: "pH looks good." },
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.title).toBe("Soil check");
    expect(body.data.farmId).toBe(farmId);
    expect(body.data.content).toBe("pH looks good.");

    const db = getAdminDb();
    const entry = await db.query.fieldJournalEntries.findFirst({
      where: { id: body.data.id as string },
    });
    expect(entry).toBeDefined();
    expect(entry!.title).toBe("Soil check");
  });

  it("creates an entry without content", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });

    const res = await request("POST", "/v1/farm/fieldJournal", { title: "Quick note", date: "2024-06-01" }, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { content: unknown } };
    expect(body.data.content).toBeNull();
  });

  it("lists journal entries, newest date first", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });

    await createJournalEntry(jwt, { date: "2024-01-01", title: "Old entry" });
    await createJournalEntry(jwt, { date: "2024-06-15", title: "New entry" });

    const res = await request("GET", "/v1/farm/fieldJournal", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: { title: string }[] } };
    expect(body.data.entries).toHaveLength(2);
    expect(body.data.entries[0].title).toBe("New entry");
    expect(body.data.entries[1].title).toBe("Old entry");
  });

  it("gets a single journal entry by id", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });
    const entry = await createJournalEntry(jwt);

    const res = await request("GET", `/v1/farm/fieldJournal/byId/${entry.id}`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.id).toBe(entry.id);
    expect(body.data.images).toEqual([]);
  });

  it("updates title, date, and content", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });
    const entry = await createJournalEntry(jwt);

    const res = await request(
      "PATCH",
      `/v1/farm/fieldJournal/byId/${entry.id}`,
      { title: "Updated title", content: "Updated content" },
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.title).toBe("Updated title");
    expect(body.data.content).toBe("Updated content");
  });

  it("deletes a journal entry", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });
    const entry = await createJournalEntry(jwt);

    const res = await request("DELETE", `/v1/farm/fieldJournal/byId/${entry.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    const db = getAdminDb();
    const dbEntry = await db.query.fieldJournalEntries.findFirst({
      where: { id: entry.id as string },
    });
    expect(dbEntry).toBeUndefined();
  });

  it("requires authentication", async () => {
    const res = await request("GET", "/v1/farm/fieldJournal");
    expect(res.status).toBe(401);
  });
});

describe("Field Journal — farm isolation", () => {
  beforeEach(cleanDb);

  it("farm A cannot read farm B journal entries", async () => {
    const { jwt: jwtA } = await createUserWithFarm({}, "a@test.com", { withActiveMembership: true });
    const { jwt: jwtB } = await createUserWithFarm({}, "b@test.com", { withActiveMembership: true });

    const entry = await createJournalEntry(jwtA);

    const res = await request("GET", `/v1/farm/fieldJournal/byId/${entry.id}`, undefined, jwtB);
    expect(res.status).toBe(404);
  });

  it("farm A cannot update farm B journal entries", async () => {
    const { jwt: jwtA } = await createUserWithFarm({}, "a@test.com", { withActiveMembership: true });
    const { jwt: jwtB } = await createUserWithFarm({}, "b@test.com", { withActiveMembership: true });

    const entry = await createJournalEntry(jwtA);

    const res = await request("PATCH", `/v1/farm/fieldJournal/byId/${entry.id}`, { title: "Hacked" }, jwtB);
    expect(res.status).toBe(404);
  });

  it("farm A cannot delete farm B journal entries (RLS no-op)", async () => {
    const { jwt: jwtA } = await createUserWithFarm({}, "a@test.com", { withActiveMembership: true });
    const { jwt: jwtB } = await createUserWithFarm({}, "b@test.com", { withActiveMembership: true });

    const entry = await createJournalEntry(jwtA);

    const res = await request("DELETE", `/v1/farm/fieldJournal/byId/${entry.id}`, undefined, jwtB);
    expect(res.status).toBe(200); // RLS silently no-ops

    const db = getAdminDb();
    const dbEntry = await db.query.fieldJournalEntries.findFirst({
      where: { id: entry.id as string },
    });
    expect(dbEntry).toBeDefined();
  });

  it("farm B cannot list farm A field journal entries", async () => {
    const { jwt: jwtA } = await createUserWithFarm({}, "a@test.com", { withActiveMembership: true });
    const { jwt: jwtB } = await createUserWithFarm({}, "b@test.com", { withActiveMembership: true });

    await createJournalEntry(jwtA);

    const res = await request("GET", "/v1/farm/fieldJournal", undefined, jwtB);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: unknown[] } };
    expect(body.data.entries).toHaveLength(0);
  });
});

describe("Field Journal — permissions", () => {
  beforeEach(cleanDb);

  it("member with write access can create entries", async () => {
    const { jwt: ownerJwt } = await createUserWithFarm({}, "owner@test.com", { withActiveMembership: true });
    const { jwt: memberJwt, userId: memberId } = await createFarmMember(ownerJwt, "member@test.com");
    await grantMemberWriteAccess(ownerJwt, memberId, "field_calendar");

    const res = await request(
      "POST",
      "/v1/farm/fieldJournal",
      { title: "Member entry", date: "2024-06-01" },
      memberJwt
    );
    expect(res.status).toBe(200);
  });

  it("member without field_calendar access cannot create entries", async () => {
    const { jwt: ownerJwt } = await createUserWithFarm({}, "owner@test.com", { withActiveMembership: true });
    const { jwt: memberJwt } = await createFarmMember(ownerJwt, "member@test.com");

    const res = await request(
      "POST",
      "/v1/farm/fieldJournal",
      { title: "Unauthorized entry", date: "2024-06-01" },
      memberJwt
    );
    expect(res.status).toBe(403);
  });
});

describe("Field Journal — image registration", () => {
  beforeEach(cleanDb);

  it("rejects registerImage with path not scoped to the journal entry", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });
    const entry = await createJournalEntry(jwt);

    const res = await request(
      "POST",
      "/v1/farm/fieldJournal/images",
      { journalEntryId: entry.id, storagePath: "some-other-folder/image.jpg" },
      jwt
    );
    expect(res.status).toBe(400);
  });

  it("deletes an image record", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });
    const entry = await createJournalEntry(jwt);

    const db = getAdminDb();
    const [image] = await db
      .insert(fieldJournalImages)
      .values({ journalEntryId: entry.id as string, storagePath: `${entry.id}/test.jpg` })
      .returning();

    const res = await request("DELETE", `/v1/farm/fieldJournal/images/byId/${image.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    const dbImage = await db.query.fieldJournalImages.findFirst({ where: { id: image.id } });
    expect(dbImage).toBeUndefined();
  });

  it("deleted entry cascades image DB records", async () => {
    const { jwt } = await createUserWithFarm({}, "test@test.com", { withActiveMembership: true });
    const entry = await createJournalEntry(jwt);

    const db = getAdminDb();
    await db.insert(fieldJournalImages).values([
      { journalEntryId: entry.id as string, storagePath: `${entry.id}/img1.jpg` },
      { journalEntryId: entry.id as string, storagePath: `${entry.id}/img2.jpg` },
    ]);

    await request("DELETE", `/v1/farm/fieldJournal/byId/${entry.id}`, undefined, jwt);

    const images = await db.query.fieldJournalImages.findMany({
      where: { journalEntryId: entry.id as string },
    });
    expect(images).toHaveLength(0);
  });
});
