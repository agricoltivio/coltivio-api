import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, getAdminDb, request } from "./helpers";
import * as schema from "../db/schema";
import { createUserWithFarm, createPlot, createCrop, createCropRotation } from "./test-utils";

// ---------------------------------------------------------------------------
// Crop Rotations CRUD
// ---------------------------------------------------------------------------
describe("Crop Rotations CRUD", () => {
  beforeEach(cleanDb);

  it("creates a crop rotation and retrieves it by id", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const plot = await createPlot(jwt, { name: "RotationField" });
    const crop = await createCrop(jwt, { name: "Winter Wheat", category: "grain" });
    const rotation = await createCropRotation(jwt, plot.id, crop.id, {
      fromDate: "2025-03-01",
      toDate: "2025-10-31",
    });

    expect(rotation.farmId).toBe(farmId);
    expect(rotation.plotId).toBe(plot.id);
    expect(rotation.cropId).toBe(crop.id);

    // Verify DB
    const db = getAdminDb();
    const dbRotation = await db.query.cropRotations.findFirst({
      where: { id: rotation.id },
    });
    expect(dbRotation!.plotId).toBe(plot.id);
    expect(dbRotation!.cropId).toBe(crop.id);
    expect(dbRotation!.farmId).toBe(farmId);

    // GET by id includes crop
    const getRes = await request("GET", `/v1/cropRotations/byId/${rotation.id}`, undefined, jwt);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as {
      data: { crop: { id: string; name: string } };
    };
    expect(getBody.data.crop.id).toBe(crop.id);
    expect(getBody.data.crop.name).toBe("Winter Wheat");
  });

  it("lists crop rotations for farm", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);
    const crop1 = await createCrop(jwt, { name: "Wheat" });
    const crop2 = await createCrop(jwt, { name: "Barley" });
    await createCropRotation(jwt, plot.id, crop1.id, {
      fromDate: "2025-01-01",
      toDate: "2025-06-30",
    });
    await createCropRotation(jwt, plot.id, crop2.id, {
      fromDate: "2025-07-01",
      toDate: "2025-12-31",
    });

    const res = await request("GET", "/v1/cropRotations", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(2);
  });

  it("lists crop rotations for a specific plot with date range", async () => {
    const { jwt } = await createUserWithFarm();
    const p1 = await createPlot(jwt, { name: "Plot1" });
    const p2 = await createPlot(jwt, { name: "Plot2" });
    const crop = await createCrop(jwt);
    await createCropRotation(jwt, p1.id, crop.id);
    await createCropRotation(jwt, p2.id, crop.id);

    const res = await request(
      "GET",
      `/v1/plots/byId/${p1.id}/cropRotations?fromDate=2025-01-01&toDate=2025-12-31`,
      undefined,
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(1);
  });

  it("creates batch crop rotations by plot", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);
    const crop1 = await createCrop(jwt, { name: "C1" });
    const crop2 = await createCrop(jwt, { name: "C2" });

    const res = await request(
      "POST",
      "/v1/cropRotations/batch/byPlot",
      {
        plotId: plot.id,
        crops: [
          { cropId: crop1.id, fromDate: "2025-01-01", toDate: "2025-06-30" },
          { cropId: crop2.id, fromDate: "2025-07-01", toDate: "2025-12-31" },
        ],
      },
      jwt
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(2);

    // Verify DB
    const db = getAdminDb();
    const dbRotations = await db.query.cropRotations.findMany({
      where: { plotId: plot.id },
    });
    expect(dbRotations).toHaveLength(2);
  });

  it("updates a crop rotation", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);
    const crop = await createCrop(jwt, { name: "OldCrop" });
    const rotation = await createCropRotation(jwt, plot.id, crop.id);

    const newCrop = await createCrop(jwt, { name: "NewCrop" });
    const res = await request(
      "PATCH",
      `/v1/cropRotations/byId/${rotation.id}`,
      { cropId: newCrop.id, sowingDate: "2025-02-15" },
      jwt
    );
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbRotation = await db.query.cropRotations.findFirst({
      where: { id: rotation.id },
    });
    expect(dbRotation!.cropId).toBe(newCrop.id);
  });

  it("deletes a crop rotation", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);
    const crop = await createCrop(jwt);
    const rotation = await createCropRotation(jwt, plot.id, crop.id);

    const res = await request("DELETE", `/v1/cropRotations/byId/${rotation.id}`, undefined, jwt);
    expect(res.status).toBe(200);

    // Verify DB
    const db = getAdminDb();
    const dbRotation = await db.query.cropRotations.findFirst({
      where: { id: rotation.id },
    });
    expect(dbRotation).toBeUndefined();
  });

  it("returns crop rotation years", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);
    const crop = await createCrop(jwt);
    await createCropRotation(jwt, plot.id, crop.id, {
      fromDate: "2025-03-01",
      toDate: "2025-10-31",
    });

    const res = await request("GET", "/v1/cropRotations/years", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { result: string[] } };
    expect(body.data.result).toContain("2025");
  });

  it("marks crop as in use when referenced by a rotation", async () => {
    const { jwt } = await createUserWithFarm();
    const plot = await createPlot(jwt);
    const crop = await createCrop(jwt, { name: "UsedCrop" });
    await createCropRotation(jwt, plot.id, crop.id);

    const res = await request("GET", `/v1/crops/byId/${crop.id}/inUse`, undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { inUse: boolean } };
    expect(body.data.inUse).toBe(true);
  });
});
