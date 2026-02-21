import { expect } from "@jest/globals";
import merge from "lodash/merge";
import { createTestUser, request } from "./helpers";

// ---------------------------------------------------------------------------
// Common test data
// ---------------------------------------------------------------------------

const DEFAULT_FARM = {
  name: "Test Farm",
  address: "123 Farm St",
  location: { type: "Point" as const, coordinates: [8.5, 47.3] as [number, number] },
};

const DEFAULT_ANIMAL = {
  name: "Bella",
  type: "cow" as const,
  sex: "female" as const,
  dateOfBirth: "2020-01-15",
  registered: true,
  usage: "milk" as const,
};

const DEFAULT_HERD = {
  name: "Test Herd",
  animalIds: [] as string[],
};

const DEFAULT_PLOT = {
  name: "Test Plot",
  geometry: {
    type: "MultiPolygon" as const,
    coordinates: [
      [[[8.0, 47.0], [8.1, 47.0], [8.1, 47.1], [8.0, 47.1], [8.0, 47.0]]],
    ],
  },
  size: 10000,
};

const DEFAULT_CROP = {
  name: "Wheat",
  category: "grain" as const,
};

const DEFAULT_CROP_FAMILY = {
  name: "Legumes",
  waitingTimeInYears: 3,
};

const DEFAULT_DRUG = {
  name: "TestDrug",
  criticalAntibiotic: false,
  receivedFrom: "Vet Clinic",
  drugTreatment: [
    {
      animalType: "cow" as const,
      doseValue: 5,
      doseUnit: "ml" as const,
      dosePerUnit: "kg" as const,
      milkWaitingDays: 3,
      meatWaitingDays: 14,
      organsWaitingDays: 7,
    },
  ],
};

const DEFAULT_TREATMENT = {
  name: "Deworming",
  startDate: "2025-01-01",
  endDate: "2025-01-03",
  criticalAntibiotic: false,
  antibiogramAvailable: false,
};

const DEFAULT_FERTILIZER = {
  name: "Compost",
  type: "organic" as const,
  unit: "kg" as const,
};

const DEFAULT_CROP_PROTECTION_PRODUCT = {
  name: "Herbicide X",
  unit: "l" as const,
};

const DEFAULT_TILLAGE = {
  action: "plowing" as const,
  date: "2025-03-15",
};

const DEFAULT_CROP_ROTATION = {
  fromDate: "2025-03-01",
  toDate: "2025-10-31",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const TEST_GEOMETRY = DEFAULT_PLOT.geometry;

type ApiEntity = Record<string, unknown> & { id: string; farmId: string };

export async function createUserWithFarm(
  data?: Record<string, unknown>,
  email = "test@test.com",
) {
  const { jwt, userId } = await createTestUser(email, "password123");
  const farmData = merge({}, DEFAULT_FARM, data);
  const res = await request("POST", "/v1/farm", farmData, jwt);
  const body = (await res.json()) as { data: { id: string } };
  return { jwt, userId, farmId: body.data.id };
}

export async function createAnimal(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_ANIMAL, data);
  const res = await request("POST", "/v1/animals", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createHerd(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_HERD, data);
  const res = await request("POST", "/v1/animals/herds", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createPlot(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_PLOT, data);
  const res = await request("POST", "/v1/plots", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createCrop(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_CROP, data);
  const res = await request("POST", "/v1/crops", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createCropFamily(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_CROP_FAMILY, data);
  const res = await request("POST", "/v1/crops/families", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createDrug(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_DRUG, data);
  const res = await request("POST", "/v1/drugs", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createTreatment(
  jwt: string,
  animalIds: string[],
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_TREATMENT, data, { animalIds });
  const res = await request("POST", "/v1/treatments", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createFertilizer(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_FERTILIZER, data);
  const res = await request("POST", "/v1/fertilizers", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createCropProtectionProduct(
  jwt: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_CROP_PROTECTION_PRODUCT, data);
  const res = await request("POST", "/v1/cropProtectionProducts", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createTillage(
  jwt: string,
  plotId: string,
  data?: Record<string, unknown>,
) {
  const payload = merge(
    {},
    DEFAULT_TILLAGE,
    { plotId, geometry: DEFAULT_PLOT.geometry, size: DEFAULT_PLOT.size },
    data,
  );
  const res = await request("POST", "/v1/tillages", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createCropRotation(
  jwt: string,
  plotId: string,
  cropId: string,
  data?: Record<string, unknown>,
) {
  const payload = merge({}, DEFAULT_CROP_ROTATION, { plotId, cropId }, data);
  const res = await request("POST", "/v1/cropRotations", payload, jwt);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: ApiEntity }).data;
}

export async function createHarvests(
  jwt: string,
  plotId: string,
  cropId: string,
  data?: {
    date?: string;
    unit?: string;
    kilosPerUnit?: number;
    numberOfUnits?: number;
    conservationMethod?: string;
  },
) {
  const res = await request(
    "POST",
    "/v1/harvests/batch",
    {
      date: data?.date ?? "2025-07-15",
      cropId,
      unit: data?.unit ?? "round_bale",
      kilosPerUnit: data?.kilosPerUnit ?? 300,
      conservationMethod: data?.conservationMethod,
      plots: [
        {
          plotId,
          geometry: DEFAULT_PLOT.geometry,
          size: DEFAULT_PLOT.size,
          numberOfUnits: data?.numberOfUnits ?? 5,
        },
      ],
    },
    jwt,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    data: { result: Array<Record<string, unknown> & { id: string }>; count: number };
  };
  return body.data.result;
}

export async function createFertilizerApplication(
  jwt: string,
  plotId: string,
  fertilizerId: string,
  data?: {
    date?: string;
    unit?: string;
    amountPerUnit?: number;
    numberOfUnits?: number;
    method?: string;
  },
) {
  const res = await request(
    "POST",
    "/v1/fertilizerApplications",
    {
      date: data?.date ?? "2025-04-15",
      unit: data?.unit ?? "load",
      amountPerUnit: data?.amountPerUnit ?? 500,
      method: data?.method,
      fertilizerId,
      plots: [
        {
          plotId,
          numberOfUnits: data?.numberOfUnits ?? 3,
          geometry: DEFAULT_PLOT.geometry,
          size: DEFAULT_PLOT.size,
        },
      ],
    },
    jwt,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    data: { result: Array<Record<string, unknown> & { id: string }>; count: number };
  };
  return body.data.result;
}

export async function createCropProtectionApplication(
  jwt: string,
  plotId: string,
  productId: string,
  data?: {
    dateTime?: string;
    unit?: string;
    amountPerUnit?: number;
    numberOfUnits?: number;
    method?: string;
  },
) {
  const res = await request(
    "POST",
    "/v1/cropProtectionApplications",
    {
      plotId,
      dateTime: data?.dateTime ?? "2025-06-15T08:00:00Z",
      productId,
      geometry: DEFAULT_PLOT.geometry,
      size: DEFAULT_PLOT.size,
      unit: data?.unit ?? "amount_per_hectare",
      amountPerUnit: data?.amountPerUnit ?? 2.5,
      numberOfUnits: data?.numberOfUnits ?? 10,
      method: data?.method,
    },
    jwt,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: Record<string, unknown> & { id: string } };
  return body.data;
}

export async function createOutdoorSchedule(
  jwt: string,
  herdId: string,
  data?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    notes?: string;
    recurrence?: Record<string, unknown>;
  },
) {
  const res = await request(
    "POST",
    `/v1/animals/herds/byId/${herdId}/outdoorSchedules`,
    {
      startDate: data?.startDate ?? "2025-05-01",
      endDate: data?.endDate ?? "2025-09-30",
      type: data?.type ?? "pasture",
      notes: data?.notes,
      recurrence: data?.recurrence,
    },
    jwt,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: Record<string, unknown> & { id: string } };
  return body.data;
}
