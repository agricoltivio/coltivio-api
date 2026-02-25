import { describe, it, expect, beforeEach } from "@jest/globals";
import { cleanDb, request } from "./helpers";
import {
  createUserWithFarm,
  createPlot,
  createCrop,
  createCropRotation,
  createAnimal,
  createHerd,
  createOutdoorSchedule,
  createTreatment,
} from "./test-utils";

// ---------------------------------------------------------------------------
// Reports - Field Calendar
// ---------------------------------------------------------------------------
// TODO: skipped due to missing ICU data in test Node.js environment
describe.skip("Field Calendar Reports", () => {
  beforeEach(cleanDb);

  it("downloads a field calendar report as base64 PDF", async () => {
    const { jwt } = await createUserWithFarm();
    // Create some data so the report has content
    const plot = await createPlot(jwt, { name: "ReportField" });
    const crop = await createCrop(jwt, { name: "Grass", category: "grass" });
    await createCropRotation(jwt, plot.id, crop.id, {
      fromDate: "2025-01-01",
      toDate: "2025-12-31",
    });

    const res = await request(
      "POST",
      "/v1/reports/fieldcalendar/download",
      {
        fromDate: "2025-01-01",
        toDate: "2025-12-31",
        generateCropRotations: true,
        generateTillages: false,
        generateFertilizerApplications: false,
        generateCropProtectionApplications: false,
        generateHarvests: false,
      },
      jwt,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { base64: string; fileName: string };
    };
    expect(body.data.base64).toBeDefined();
    expect(body.data.base64.length).toBeGreaterThan(0);
    expect(body.data.fileName).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Reports - Treatment
// ---------------------------------------------------------------------------
describe.skip("Treatment Reports", () => {
  beforeEach(cleanDb);

  it("downloads a treatment report as base64 PDF", async () => {
    const { jwt } = await createUserWithFarm();
    const animal = await createAnimal(jwt, { name: "ReportCow" });
    await createTreatment(jwt, [animal.id], {
      name: "Report Treatment",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
    });

    const res = await request(
      "POST",
      "/v1/reports/treatments/download",
      {
        fromDate: "2025-01-01",
        toDate: "2025-12-31",
      },
      jwt,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { base64: string; fileName: string };
    };
    expect(body.data.base64).toBeDefined();
    expect(body.data.base64.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reports - Outdoor Journal
// ---------------------------------------------------------------------------
describe.skip("Outdoor Journal Reports", () => {
  beforeEach(cleanDb);

  it("downloads an outdoor journal report as base64 PDF", async () => {
    const { jwt } = await createUserWithFarm();
    const sheep = await createAnimal(jwt, {
      type: "sheep",
      sex: "female",
      dateOfBirth: "2020-01-01",
      usage: "other",
    });
    const herd = await createHerd(jwt, { animalIds: [sheep.id] });
    await createOutdoorSchedule(jwt, herd.id, {
      startDate: "2025-05-01",
      endDate: "2025-09-30",
    });

    const res = await request(
      "POST",
      "/v1/reports/outdoorjournal/download",
      {
        fromDate: "2025-01-01",
        toDate: "2025-12-31",
      },
      jwt,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { base64: string; fileName: string };
    };
    expect(body.data.base64).toBeDefined();
    expect(body.data.base64.length).toBeGreaterThan(0);
  });
});
