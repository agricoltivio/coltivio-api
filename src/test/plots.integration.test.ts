import { describe, it, expect, beforeEach } from "@jest/globals";
import { eq, sql } from "drizzle-orm";

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
    const getRes = await request("GET", `/v1/plots/byId/${plot.id}`, undefined, jwt);
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
      jwt
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

  it("archives a plot: hidden from the list, not clipped by new overlapping plots, and can be unarchived", async () => {
    const { jwt } = await createUserWithFarm();
    const archivedPlot = await createPlot(jwt, { name: "Old", size: 5000 });

    const archiveRes = await request("PATCH", `/v1/plots/byId/${archivedPlot.id}`, { archived: true }, jwt);
    expect(archiveRes.status).toBe(200);
    const archived = ((await archiveRes.json()) as { data: { archivedAt: string | null } }).data;
    expect(archived.archivedAt).not.toBeNull();

    // Same geometry as the archived plot: would clip it to nothing if it weren't archived
    await createPlot(jwt, { name: "New", size: 5000 });

    const listRes = await request("GET", "/v1/plots", undefined, jwt);
    const list = ((await listRes.json()) as { data: { result: { name: string }[] } }).data.result;
    expect(list.map((plot) => plot.name)).toEqual(["New"]);

    const listAllRes = await request("GET", "/v1/plots?includeArchived=true", undefined, jwt);
    const listAll = ((await listAllRes.json()) as { data: { result: { name: string }[] } }).data.result;
    expect(listAll.map((plot) => plot.name)).toEqual(["New", "Old"]);

    const db = getAdminDb();
    const dbArchivedPlot = await db.query.plots.findFirst({ where: { id: archivedPlot.id } });
    expect(dbArchivedPlot!.size).toBe(5000);

    const unarchiveRes = await request("PATCH", `/v1/plots/byId/${archivedPlot.id}`, { archived: false }, jwt);
    const unarchived = ((await unarchiveRes.json()) as { data: { archivedAt: string | null } }).data;
    expect(unarchived.archivedAt).toBeNull();
  });

  it("deletes a plot", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);

    const res = await request("DELETE", `/v1/plots/byId/${plot.id}`, undefined, jwt);
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
        [
          [
            [8.0, 47.0],
            [8.05, 47.0],
            [8.05, 47.1],
            [8.0, 47.1],
            [8.0, 47.0],
          ],
        ],
      ],
    };
    const subGeometry2 = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [8.05, 47.0],
            [8.1, 47.0],
            [8.1, 47.1],
            [8.05, 47.1],
            [8.05, 47.0],
          ],
        ],
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
      jwt
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
      jwt
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

// ---------------------------------------------------------------------------
// Invalid geometries
// ---------------------------------------------------------------------------
describe("Plot geometry validation", () => {
  beforeEach(cleanDb);

  // Edges cross in the middle of the square
  const BOWTIE_RING = [
    [8.0, 47.0],
    [8.1, 47.1],
    [8.1, 47.0],
    [8.0, 47.1],
    [8.0, 47.0],
  ];

  async function isStoredGeometryValid(plotId: string) {
    const db = getAdminDb();
    const [row] = await db
      .select({ isValid: sql<boolean>`ST_IsValid(${schema.plots.geometry})` })
      .from(schema.plots)
      .where(eq(schema.plots.id, plotId));
    return row.isValid;
  }

  it("repairs a self-intersecting plot on create", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt, { geometry: { type: "MultiPolygon", coordinates: [[BOWTIE_RING]] } });

    expect(await isStoredGeometryValid(plot.id)).toBe(true);
  });

  it("repairs a self-intersecting plot on update", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);

    const res = await request(
      "PATCH",
      `/v1/plots/byId/${plot.id}`,
      { geometry: { type: "MultiPolygon", coordinates: [[BOWTIE_RING]] } },
      jwt
    );
    expect(res.status).toBe(200);
    expect(await isStoredGeometryValid(plot.id)).toBe(true);
  });

  it("cuts a new plot out of an overlapping plot that is stored invalid", async () => {
    const { jwt } = await createUserWithFarm();
    const invalidPlot = await createPlot(jwt, { name: "Invalid" });
    const db = getAdminDb();
    await db.execute(sql`
      update ${schema.plots}
      set geometry = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify({ type: "MultiPolygon", coordinates: [[BOWTIE_RING]] })}), 4326)
      where id = ${invalidPlot.id}
    `);
    expect(await isStoredGeometryValid(invalidPlot.id)).toBe(false);

    const newPlot = await createPlot(jwt, {
      name: "New",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [8.05, 47.0],
              [8.15, 47.0],
              [8.15, 47.1],
              [8.05, 47.1],
              [8.05, 47.0],
            ],
          ],
        ],
      },
    });

    expect(await isStoredGeometryValid(newPlot.id)).toBe(true);
    expect(await isStoredGeometryValid(invalidPlot.id)).toBe(true);
  });

  it("rejects a geometry without area with an error code", async () => {
    const { jwt } = await createUserWithFarm();
    const collinearRing = [
      [8.0, 47.0],
      [8.1, 47.0],
      [8.2, 47.0],
      [8.0, 47.0],
    ];

    const res = await request(
      "POST",
      "/v1/plots",
      { name: "Line", size: 0, geometry: { type: "MultiPolygon", coordinates: [[collinearRing]] } },
      jwt
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code?: string };
    expect(body.code).toBe("invalid_geometry");

    const db = getAdminDb();
    expect(await db.query.plots.findMany()).toHaveLength(0);
  });
});
