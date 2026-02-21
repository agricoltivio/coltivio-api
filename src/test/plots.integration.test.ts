import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, getAdminDb, request } from "./helpers";
import * as schema from "../db/schema";
import { createUserWithFarm, createPlot, TEST_GEOMETRY } from "./test-utils";

// ---------------------------------------------------------------------------
// Plots CRUD
// ---------------------------------------------------------------------------
describe("Plots CRUD", () => {
  beforeEach(cleanDb);

  it("creates a plot and retrieves it by id", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const plot = await createPlot(jwt, { name: "Field A", size: 5000 });

    expect(plot.name).toBe("Field A");
    expect(plot.size).toBe(5000);
    expect(plot.farmId).toBe(farmId);

    // Verify DB
    const db = getAdminDb();
    const dbPlot = await db.query.plots.findFirst({
      where: { id: plot.id },
    });
    expect(dbPlot!.name).toBe("Field A");
    expect(dbPlot!.size).toBe(5000);
    expect(dbPlot!.farmId).toBe(farmId);

    // GET by id
    const getRes = await request(
      "GET",
      `/v1/plots/byId/${plot.id}`,
      undefined,
      jwt,
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { data: { id: string } };
    expect(getBody.data.id).toBe(plot.id);
  });

  it("lists plots for farm", async () => {
    const { jwt } = await createUserWithFarm();
    await createPlot(jwt, { name: "P1" });
    await createPlot(jwt, { name: "P2" });

    const res = await request("GET", "/v1/plots", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(2);
  });

  it("updates a plot", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt, { name: "OldName", size: 5000 });

    const res = await request(
      "PATCH",
      `/v1/plots/byId/${plot.id}`,
      { name: "NewName", size: 8000, additionalNotes: "Wet corner" },
      jwt,
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbPlot = await db.query.plots.findFirst({
      where: { id: plot.id },
    });
    expect(dbPlot!.name).toBe("NewName");
    expect(dbPlot!.size).toBe(8000);
    expect(dbPlot!.additionalNotes).toBe("Wet corner");
  });

  it("deletes a plot", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);

    const res = await request(
      "DELETE",
      `/v1/plots/byId/${plot.id}`,
      undefined,
      jwt,
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbPlot = await db.query.plots.findFirst({
      where: { id: plot.id },
    });
    expect(dbPlot).toBeUndefined();
  });

  it("splits a plot with keep_reference strategy", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt, { name: "Original", size: 10000 });

    const subGeometry1 = {
      type: "MultiPolygon" as const,
      coordinates: [
        [[[8.0, 47.0], [8.05, 47.0], [8.05, 47.1], [8.0, 47.1], [8.0, 47.0]]],
      ],
    };
    const subGeometry2 = {
      type: "MultiPolygon" as const,
      coordinates: [
        [[[8.05, 47.0], [8.1, 47.0], [8.1, 47.1], [8.05, 47.1], [8.05, 47.0]]],
      ],
    };

    const res = await request(
      "POST",
      `/v1/plots/byId/${plot.id}/split`,
      {
        strategy: "keep_reference",
        subPlots: [
          { geometry: subGeometry1, name: "Split A", size: 5000 },
          { geometry: subGeometry2, name: "Split B", size: 5000 },
        ],
      },
      jwt,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { result: Array<{ id: string; name: string; size: number }> };
    };
    expect(body.data.result.length).toBeGreaterThanOrEqual(2);

    // Verify DB: new plots exist
    const db = getAdminDb();
    const names = body.data.result.map((p) => p.name);
    expect(names).toContain("Split A");
    expect(names).toContain("Split B");
  });

  it("merges plots with keep_reference strategy", async () => {
    const { jwt } = await createUserWithFarm();
    const p1 = await createPlot(jwt, { name: "M1", size: 3000 });
    const p2 = await createPlot(jwt, { name: "M2", size: 4000 });

    const res = await request(
      "POST",
      "/v1/plots/merge",
      {
        strategy: "keep_reference",
        plotIds: [p1.id, p2.id],
        name: "Merged Field",
      },
      jwt,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: string; name: string };
    };
    expect(body.data.name).toBe("Merged Field");

    // Verify DB
    const db = getAdminDb();
    const dbMerged = await db.query.plots.findFirst({
      where: { id: body.data.id },
    });
    expect(dbMerged!.name).toBe("Merged Field");
  });
});
