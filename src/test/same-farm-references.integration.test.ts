import { describe, it, expect, beforeEach } from "@jest/globals";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { cleanDb, getAdminDb, request } from "./helpers";
import { createAnimal, createPlot, createTillage, createUserWithFarm } from "./test-utils";

// References to records of another farm are rejected by the database (composite foreign keys on (reference,
// farm)), for every reference, not only the ones a write path checks explicitly. The API answers 400 with the
// code invalid_reference instead of storing the link.
describe("References stay within the farm", () => {
  beforeEach(cleanDb);

  async function expectInvalidReference(res: Response) {
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code?: string }).code).toBe("invalid_reference");
  }

  it("rejects another farm's animal as mother", async () => {
    const { jwt } = await createUserWithFarm({}, "own@test.com");
    const { jwt: otherJwt } = await createUserWithFarm({}, "other@test.com");
    const foreignMother = await createAnimal(otherJwt, { name: "Fremde Mutter", sex: "female" });

    const res = await request(
      "POST",
      "/v1/animals",
      {
        name: "Kalb",
        type: "cow",
        sex: "female",
        dateOfBirth: "2025-03-01",
        usage: "other",
        registered: false,
        motherId: foreignMother.id,
      },
      jwt
    );
    await expectInvalidReference(res);
  });

  it("rejects a field task on another farm's plot, the own plot works", async () => {
    const { jwt } = await createUserWithFarm({}, "own@test.com");
    const { jwt: otherJwt } = await createUserWithFarm({}, "other@test.com");
    const ownPlot = await createPlot(jwt);
    const foreignPlot = await createPlot(otherJwt);

    await createTillage(jwt, ownPlot.id);
    const res = await request(
      "POST",
      "/v1/tillages",
      { action: "plowing", date: "2025-03-15", plotId: foreignPlot.id, geometry: ownPlot.geometry, size: 1000 },
      jwt
    );
    await expectInvalidReference(res);
  });

  it("rejects an ID that doesn't exist with the same code instead of a server error", async () => {
    const { jwt } = await createUserWithFarm({}, "own@test.com");
    const res = await request(
      "POST",
      "/v1/tillages",
      {
        action: "plowing",
        date: "2025-03-15",
        plotId: "00000000-0000-4000-8000-000000000000",
        geometry: (await createPlot(jwt)).geometry,
        size: 1000,
      },
      jwt
    );
    await expectInvalidReference(res);
  });

  it("only assigns tasks to members of the farm", async () => {
    const { jwt, userId } = await createUserWithFarm({}, "own@test.com");
    const { userId: outsiderId } = await createUserWithFarm({}, "other@test.com");

    const outsiderRes = await request("POST", "/v1/tasks", { name: "Zaun flicken", assigneeId: outsiderId }, jwt);
    await expectInvalidReference(outsiderRes);

    const ownRes = await request("POST", "/v1/tasks", { name: "Zaun flicken", assigneeId: userId }, jwt);
    expect(ownRes.status).toBe(200);
  });
  // The composite keys carry the delete behaviour alone (the single column keys are gone). SET NULL only nulls the
  // reference, not farm_id (SET NULL (column) in the migration), and cascades still delete the dependent rows.
  it("deletes still set references to null or cascade", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const mother = await createAnimal(jwt, { name: "Mutter", sex: "female" });
    const calf = await createAnimal(jwt, { name: "Kalb", motherId: mother.id });
    const plot = await createPlot(jwt);
    const tillage = await createTillage(jwt, plot.id);

    expect((await request("DELETE", `/v1/animals/byId/${mother.id}`, undefined, jwt)).status).toBe(200);
    const [storedCalf] = await getAdminDb()
      .select({ motherId: schema.animals.motherId, farmId: schema.animals.farmId })
      .from(schema.animals)
      .where(eq(schema.animals.id, calf.id));
    expect(storedCalf).toEqual({ motherId: null, farmId });

    await getAdminDb().delete(schema.plots).where(eq(schema.plots.id, plot.id));
    const remainingTillages = await getAdminDb()
      .select({ id: schema.tillages.id })
      .from(schema.tillages)
      .where(eq(schema.tillages.id, tillage.id));
    expect(remainingTillages).toEqual([]);
  });
});
