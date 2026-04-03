import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, createTestUser, getAdminDb, request } from "./helpers";
import * as schema from "../db/schema";
import { createUserWithFarm, createFarmMember } from "./test-utils";

// ---------------------------------------------------------------------------
// Farm CRUD
// ---------------------------------------------------------------------------
describe("Farm CRUD", () => {
  beforeEach(cleanDb);

  it("creates a farm and retrieves it", async () => {
    const { jwt, farmId } = await createUserWithFarm(
      { name: "Sunshine Farm", address: "42 Alpine Rd" },
      undefined,
      { withActiveMembership: true }
    );

    // Verify DB
    const db = getAdminDb();
    const dbFarm = await db.query.farms.findFirst({
      where: { id: farmId },
    });
    expect(dbFarm!.name).toBe("Sunshine Farm");
    expect(dbFarm!.address).toBe("42 Alpine Rd");

    // Verify API
    const res = await request("GET", "/v1/farm", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: string; name: string; address: string; location: { coordinates: number[] } };
    };
    expect(body.data.id).toBe(farmId);
    expect(body.data.name).toBe("Sunshine Farm");
    expect(body.data.address).toBe("42 Alpine Rd");
    expect(body.data.location.coordinates).toEqual([8.5, 47.3]);
  });

  it("rejects creating a second farm for same user", async () => {
    const { jwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });
    const res = await request(
      "POST",
      "/v1/farm",
      {
        name: "Second Farm",
        address: "Somewhere",
        location: { type: "Point", coordinates: [8.0, 47.0] },
      },
      jwt
    );
    expect(res.status).toBe(400);

    // Verify DB: still only one farm
    const db = getAdminDb();
    const farms = await db.query.farms.findMany({});
    expect(farms).toHaveLength(1);
  });

  it("updates a farm", async () => {
    const { jwt, farmId } = await createUserWithFarm({ name: "OldName" }, undefined, { withActiveMembership: true });

    const res = await request("PATCH", "/v1/farm", { name: "NewName", address: "New Address 1" }, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { name: string; address: string };
    };
    expect(body.data.name).toBe("NewName");
    expect(body.data.address).toBe("New Address 1");

    // Verify DB
    const db = getAdminDb();
    const dbFarm = await db.query.farms.findFirst({
      where: { id: farmId },
    });
    expect(dbFarm!.name).toBe("NewName");
    expect(dbFarm!.address).toBe("New Address 1");
  });

  it("updates farm federalId and tvdId", async () => {
    const { jwt, farmId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("PATCH", "/v1/farm", { federalId: "CH-1234", tvdId: "TVD-5678" }, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbFarm = await db.query.farms.findFirst({
      where: { id: farmId },
    });
    expect(dbFarm!.federalId).toBe("CH-1234");
    expect(dbFarm!.tvdId).toBe("TVD-5678");
  });

  it("deletes a farm without deleting account", async () => {
    const { jwt, farmId, userId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("DELETE", "/v1/farm?deleteAccount=false", undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB: farm gone, user profile still exists
    const db = getAdminDb();
    const dbFarm = await db.query.farms.findFirst({
      where: { id: farmId },
    });
    expect(dbFarm).toBeUndefined();

    const dbProfile = await db.query.profiles.findFirst({
      where: { id: userId },
    });
    expect(dbProfile).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
describe("Users", () => {
  beforeEach(cleanDb);

  it("retrieves own user profile", async () => {
    const { jwt, userId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("GET", "/v1/me", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: string; email: string; farmId: string | null };
    };
    expect(body.data.id).toBe(userId);
    expect(body.data.email).toBe("test@test.com");
    expect(body.data.farmId).not.toBeNull();
  });

  it("updates own user profile", async () => {
    const { jwt, userId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("PATCH", "/v1/me", { fullName: "John Doe" }, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { fullName: string | null } };
    expect(body.data.fullName).toBe("John Doe");

    // Verify DB
    const db = getAdminDb();
    const dbProfile = await db.query.profiles.findFirst({
      where: { id: userId },
    });
    expect(dbProfile!.fullName).toBe("John Doe");
  });

  it("lists farm users", async () => {
    const { jwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("GET", "/v1/users", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: unknown[]; count: number };
    };
    expect(body.data.count).toBe(1);
  });

  it("retrieves user by id", async () => {
    const { jwt, userId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("GET", `/v1/users/byId/${userId}`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(userId);
  });
});

// ---------------------------------------------------------------------------
// Farm Invites (with role)
// ---------------------------------------------------------------------------
describe("Farm Invites", () => {
  beforeEach(cleanDb);

  it("creates an invite with default member role", async () => {
    const { jwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("POST", "/v1/farm/invites", { email: "member@test.com" }, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { email: string; role: string } };
    expect(body.data.email).toBe("member@test.com");
    expect(body.data.role).toBe("member");
  });

  it("creates an invite with owner role", async () => {
    const { jwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });

    const res = await request("POST", "/v1/farm/invites", { email: "co-owner@test.com", role: "owner" }, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { role: string } };
    expect(body.data.role).toBe("owner");
  });

  it("accepted invite assigns the role from the invite", async () => {
    const { jwt: ownerJwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });
    const { userId: memberId } = await createFarmMember(ownerJwt, "member@test.com", { role: "member" });

    const db = getAdminDb();
    const profile = await db.query.profiles.findFirst({ where: { id: memberId } });
    expect(profile?.farmRole).toBe("member");
  });

  it("accepted invite with owner role sets the invitee as owner", async () => {
    const { jwt: ownerJwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });
    const { userId: coOwnerId } = await createFarmMember(ownerJwt, "coowner@test.com", { role: "owner" });

    const db = getAdminDb();
    const profile = await db.query.profiles.findFirst({ where: { id: coOwnerId } });
    expect(profile?.farmRole).toBe("owner");
  });

  it("non-owner cannot create invites", async () => {
    const { jwt: ownerJwt } = await createUserWithFarm({}, undefined, { withActiveMembership: true });
    const { jwt: memberJwt } = await createFarmMember(ownerJwt, "member@test.com");

    const res = await request("POST", "/v1/farm/invites", { email: "another@test.com" }, memberJwt);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Owner-only actions
// ---------------------------------------------------------------------------
describe("Owner-only actions", () => {
  beforeEach(cleanDb);

  it("member cannot update farm settings", async () => {
    const { jwt: ownerJwt } = await createUserWithFarm({ name: "Owner Farm" }, undefined, { withActiveMembership: true });
    const { jwt: memberJwt } = await createFarmMember(ownerJwt, "member@test.com");

    const res = await request("PATCH", "/v1/farm", { name: "Hacked" }, memberJwt);
    expect(res.status).toBe(403);
  });

  it("owner can update farm settings", async () => {
    const { jwt } = await createUserWithFarm({ name: "Original Name" }, undefined, { withActiveMembership: true });

    const res = await request("PATCH", "/v1/farm", { name: "Updated Name" }, jwt);
    expect(res.status).toBe(200);
  });

  it("member cannot kick other members", async () => {
    const { jwt: ownerJwt, userId: ownerId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });
    const { jwt: memberJwt } = await createFarmMember(ownerJwt, "member@test.com");

    const res = await request("DELETE", `/v1/farm/members/byId/${ownerId}`, undefined, memberJwt);
    expect(res.status).toBe(403);
  });

  it("member cannot change member roles", async () => {
    const { jwt: ownerJwt, userId: ownerId } = await createUserWithFarm({}, undefined, { withActiveMembership: true });
    const { jwt: memberJwt } = await createFarmMember(ownerJwt, "member@test.com");

    const res = await request("PATCH", `/v1/farm/members/byId/${ownerId}/role`, { role: "member" }, memberJwt);
    expect(res.status).toBe(403);
  });
});
