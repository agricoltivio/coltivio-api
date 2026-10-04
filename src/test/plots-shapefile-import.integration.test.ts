import { describe, it, expect, beforeEach } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import JSZip from "jszip";
import { sql } from "drizzle-orm";

import { cleanDb, getAdminDb, request } from "./helpers";
import * as schema from "../db/schema";
import { createUserWithFarm } from "./test-utils";

const FIXTURE_DIR = path.join(__dirname, "fixtures", "shapefile");
const FIXTURE_BASENAME = "betriebsansicht-kul_poly";

type PreviewRow = {
  rowNumber: number;
  externalId: string | null;
  name: string;
  localId: string | null;
  usage: number | null;
  usageName: string | null;
  size: number;
  municipality: string | null;
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] } | null;
  overlappingPlotIds: string[];
  parseErrors: string[];
};

async function buildFixtureZip(overrides: Record<string, Buffer> = {}) {
  const zip = new JSZip();
  for (const extension of [".shp", ".shx", ".dbf", ".prj"]) {
    const fileName = FIXTURE_BASENAME + extension;
    zip.file(`export/${fileName}`, overrides[extension] ?? readFileSync(path.join(FIXTURE_DIR, fileName)));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

// Minimal DBF with a single unknown character field "Foo" and one (blank) record per shape.
function buildDbfWithUnknownField(numberOfRecords: number) {
  const headerLength = 32 + 32 + 1;
  const recordLength = 1 + 10;
  const buffer = Buffer.alloc(headerLength + numberOfRecords * recordLength + 1, " ");
  buffer.fill(0, 0, headerLength);
  buffer[0] = 0x03;
  buffer.writeUInt32LE(numberOfRecords, 4);
  buffer.writeUInt16LE(headerLength, 8);
  buffer.writeUInt16LE(recordLength, 10);
  buffer.write("Foo", 32, "latin1");
  buffer[32 + 11] = "C".charCodeAt(0);
  buffer[32 + 16] = 10;
  buffer[64] = 0x0d;
  buffer[buffer.length - 1] = 0x1a;
  return buffer;
}

async function uploadZip(zipBuffer: Buffer, jwt: string) {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" }), "plots.zip");
  return fetch(`${process.env.SERVER_URL!}/v1/plots/import/preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
}

type PreviewResponse = { data: { completeness: "full" | "partial" | "geometries_only"; rows: PreviewRow[] } };

async function previewFixture(jwt: string) {
  const res = await uploadZip(await buildFixtureZip(), jwt);
  expect(res.status).toBe(200);
  const body = (await res.json()) as PreviewResponse;
  expect(body.data.completeness).toBe("full");
  return body.data.rows;
}

// The fixture .dbf with the LNFCode (first field) of the first record blanked out.
function buildFixtureDbfWithoutFirstUsageCode() {
  const dbf = Buffer.from(readFileSync(path.join(FIXTURE_DIR, `${FIXTURE_BASENAME}.dbf`)));
  const headerLength = dbf.readUInt16LE(8);
  const lnfCodeLength = dbf[32 + 16];
  dbf.fill(" ", headerLength + 1, headerLength + 1 + lnfCodeLength);
  return dbf;
}

function toCommitRow(row: PreviewRow) {
  return {
    name: row.name,
    localId: row.localId ?? undefined,
    usage: row.usage ?? undefined,
    size: row.size,
    geometry: row.geometry!,
  };
}

describe("Plot shapefile import — preview + commit", () => {
  beforeEach(cleanDb);

  it("preview parses all features of the kul_poly export without writing to the DB", async () => {
    const { jwt } = await createUserWithFarm();
    const rows = await previewFixture(jwt);

    expect(rows).toHaveLength(142);
    expect(rows[0]).toMatchObject({
      rowNumber: 1,
      externalId: "3989966837",
      name: "377",
      localId: "377",
      usage: 611,
      usageName: "Extensiv genutzte Wiesen (ohne Weiden)",
      size: 5539,
      municipality: "Rossa",
      overlappingPlotIds: [],
      parseErrors: [],
    });

    // reprojected from LV95 to WGS84
    const [longitude, latitude] = rows[0].geometry!.coordinates[0][0][0];
    expect(longitude).toBeGreaterThan(9);
    expect(longitude).toBeLessThan(10);
    expect(latitude).toBeGreaterThan(46);
    expect(latitude).toBeLessThan(47);

    for (const row of rows) {
      expect(row.geometry?.type).toBe("MultiPolygon");
      expect(row.parseErrors).toEqual([]);
    }

    // The polygon area (from the .shp) must match the declared area FlaeLN (from the .dbf) for every feature.
    // This catches lost holes, missing parts, mixed up rings and reprojection errors.
    const db = getAdminDb();
    const geometriesJson = JSON.stringify(rows.map((row) => row.geometry));
    const areas = await db.execute<{ area: number }>(
      sql`select ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326), 2056)) as area
          from json_array_elements(${geometriesJson}::json) with ordinality as feature(geometry, position)
          order by position`
    );
    expect(areas).toHaveLength(142);
    for (const [index, row] of rows.entries()) {
      expect(Math.abs(areas[index].area - row.size)).toBeLessThan(1);
    }

    const plotCount = await db.$count(schema.plots);
    expect(plotCount).toBe(0);
  });

  it("commit creates all plots of the file with valid geometries", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const rows = await previewFixture(jwt);
    // commit the whole file, the request body is well above express' default 100kb json limit
    const selectedRows = rows;

    const commitRes = await request("POST", "/v1/plots/import/commit", { rows: selectedRows.map(toCommitRow) }, jwt);
    expect(commitRes.status).toBe(200);
    const commitBody = (await commitRes.json()) as { data: { created: number } };
    expect(commitBody.data.created).toBe(142);

    const listRes = await request("GET", "/v1/plots", undefined, jwt);
    const listBody = (await listRes.json()) as {
      data: { count: number; result: { localId: string | null; usage: number | null }[] };
    };
    expect(listBody.data.count).toBe(142);
    expect(listBody.data.result.map((plot) => plot.localId).sort()).toEqual(
      selectedRows.map((row) => row.localId).sort()
    );

    const db = getAdminDb();
    const invalidGeometries = await db.execute<{ id: string }>(
      sql`select ${schema.plots.id} from ${schema.plots} where ${schema.plots.farmId} = ${farmId} and not ST_IsValid(${schema.plots.geometry})`
    );
    expect(invalidGeometries).toHaveLength(0);

    // The stored polygon of row 1 must sit where it is in the shapefile: first vertex in LV95 and its area.
    const [storedPlot] = await db.execute<{ distance_to_first_vertex: number; area: number }>(
      sql`select
            ST_Distance(ST_Transform(${schema.plots.geometry}, 2056), ST_SetSRID(ST_MakePoint(2729723.497, 1137585.979), 2056)) as distance_to_first_vertex,
            ST_Area(ST_Transform(${schema.plots.geometry}, 2056)) as area
          from ${schema.plots}
          where ${schema.plots.farmId} = ${farmId} and ${schema.plots.localId} = '377'`
    );
    expect(storedPlot.distance_to_first_vertex).toBeLessThan(0.05);
    expect(Math.abs(storedPlot.area - 5539.3)).toBeLessThan(1);
  });

  it("preview flags rows that overlap existing plots", async () => {
    const { jwt } = await createUserWithFarm();
    const rows = await previewFixture(jwt);

    const createRes = await request("POST", "/v1/plots", toCommitRow(rows[0]), jwt);
    expect(createRes.status).toBe(200);
    const existingPlot = ((await createRes.json()) as { data: { id: string } }).data;

    const secondPreview = await previewFixture(jwt);
    expect(secondPreview[0].overlappingPlotIds).toEqual([existingPlot.id]);
    // neighbouring plots only share a border and must not be flagged
    const flaggedRows = secondPreview.filter((row) => row.overlappingPlotIds.length > 0);
    expect(flaggedRows.map((row) => row.rowNumber)).toEqual([1]);
  });

  it("reports partial completeness and defaults the usage when a row has no usage code", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await uploadZip(await buildFixtureZip({ ".dbf": buildFixtureDbfWithoutFirstUsageCode() }), jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PreviewResponse;
    expect(body.data.completeness).toBe("partial");
    expect(body.data.rows[0]).toMatchObject({ localId: "377", usage: 613, size: 5539, parseErrors: [] });
    expect(body.data.rows[1].usage).toBe(611);
  });

  it("finds the files by extension regardless of their names", async () => {
    const { jwt } = await createUserWithFarm();
    const zip = new JSZip();
    zip.file("Parzellen 2026.SHP", readFileSync(path.join(FIXTURE_DIR, `${FIXTURE_BASENAME}.shp`)));
    zip.file("some/folder/attribute.dbf", readFileSync(path.join(FIXTURE_DIR, `${FIXTURE_BASENAME}.dbf`)));
    zip.file("index.shx", readFileSync(path.join(FIXTURE_DIR, `${FIXTURE_BASENAME}.shx`)));
    const res = await uploadZip(await zip.generateAsync({ type: "nodebuffer" }), jwt);
    expect(res.status).toBe(200);
    const rows = ((await res.json()) as { data: { rows: PreviewRow[] } }).data.rows;
    expect(rows).toHaveLength(142);
    expect(rows[0]).toMatchObject({ localId: "377", usage: 611, size: 5539 });
  });

  it("rejects a file that is not a zip", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await uploadZip(Buffer.from("not a zip"), jwt);
    expect(res.status).toBe(400);
  });

  it("imports only the geometry with defaults when the attribute fields are unknown", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await uploadZip(await buildFixtureZip({ ".dbf": buildDbfWithUnknownField(142) }), jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PreviewResponse;
    expect(body.data.completeness).toBe("geometries_only");
    const rows = body.data.rows;

    expect(rows).toHaveLength(142);
    expect(rows[0]).toMatchObject({
      rowNumber: 1,
      externalId: null,
      name: "Schlag 1",
      localId: null,
      usage: 613,
      usageName: null,
      municipality: null,
      overlappingPlotIds: [],
      parseErrors: [],
    });
    expect(rows[141].name).toBe("Schlag 142");
    // size is computed from the polygon (row 1 is 5539.3 m² in LV95)
    expect(Math.abs(rows[0].size - 5539)).toBeLessThanOrEqual(1);
    expect(rows[0].geometry?.type).toBe("MultiPolygon");
  });

  it("rejects a dbf whose record count does not match the shapes", async () => {
    const { jwt } = await createUserWithFarm();
    const res = await uploadZip(await buildFixtureZip({ ".dbf": buildDbfWithUnknownField(3) }), jwt);
    expect(res.status).toBe(400);
  });
});
