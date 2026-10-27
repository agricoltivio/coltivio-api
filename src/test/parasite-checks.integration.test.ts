import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, getAdminDb, request } from "./helpers";
import { createUserWithFarm, createAnimal, createHerd, createTreatment } from "./test-utils";

type CheckResponse = {
  id: string;
  method: string;
  herdId: string | null;
  previousCheckId: string | null;
  treatmentId: string | null;
  animals: Array<{ animalId: string; famachaScore: number | null }>;
  fecSamples: Array<{
    id: string;
    pooled: boolean;
    animalIds: string[];
    results: Array<{ parasiteType: string; countPerGram: number }>;
  }>;
  followUpTasks: Array<{ id: string; name: string; dueDate: string | null }>;
  summary: {
    animalCount: number;
    famachaAverage: number | null;
    famachaDistribution: Array<{ score: number; count: number }>;
    fecByParasite: Array<{ parasiteType: string; avgCountPerGram: number; sampleCount: number }>;
  };
  comparisonToPrevious: {
    previousCheckId: string;
    famachaAverageChange: number | null;
    fecReduction: Array<{ parasiteType: string; reductionPercent: number | null }>;
  } | null;
};

async function createCheck(jwt: string, payload: Record<string, unknown>) {
  const res = await request("POST", "/v1/parasiteChecks", payload, jwt);
  return { status: res.status, body: (await res.json()) as { data: CheckResponse } };
}

describe("Parasite checks", () => {
  beforeEach(cleanDb);

  it("creates a FAMACHA check for a herd, resolving herd members at the check date", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "Sheep1", type: "sheep" });
    const a2 = await createAnimal(jwt, { name: "Sheep2", type: "sheep" });
    await createAnimal(jwt, { name: "NotInHerd", type: "sheep" });
    const herd = await createHerd(jwt, { name: "Sheep Herd", animalIds: [a1.id, a2.id], effectiveDate: "2025-01-01" });

    const { status, body } = await createCheck(jwt, { date: "2025-06-01", method: "famacha", herdId: herd.id });
    expect(status).toBe(200);
    expect(body.data.herdId).toBe(herd.id);
    expect(body.data.animals.map((checkAnimal) => checkAnimal.animalId).sort()).toEqual([a1.id, a2.id].sort());
    expect(body.data.summary.animalCount).toBe(2);
    expect(body.data.followUpTasks).toHaveLength(0);
  });

  it("creates a check with only animals (no herd) with FAMACHA scores", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "Goat1", type: "goat" });
    const a2 = await createAnimal(jwt, { name: "Goat2", type: "goat" });

    const { status, body } = await createCheck(jwt, {
      date: "2025-06-01",
      method: "famacha",
      animals: [
        { animalId: a1.id, famachaScore: 2 },
        { animalId: a2.id, famachaScore: 4 },
      ],
    });
    expect(status).toBe(200);
    expect(body.data.herdId).toBeNull();
    expect(body.data.summary.famachaAverage).toBe(3);
    expect(body.data.summary.famachaDistribution.find((entry) => entry.score === 4)!.count).toBe(1);

    const listRes = await request("GET", "/v1/parasiteChecks", undefined, jwt);
    const listBody = (await listRes.json()) as { data: { count: number } };
    expect(listBody.data.count).toBe(1);

    const historyRes = await request("GET", `/v1/animals/byId/${a2.id}/parasiteHistory`, undefined, jwt);
    expect(historyRes.status).toBe(200);
    const historyBody = (await historyRes.json()) as { data: { checks: Array<{ famachaScore: number | null }> } };
    expect(historyBody.data.checks).toHaveLength(1);
    expect(historyBody.data.checks[0].famachaScore).toBe(4);
  });

  it("dedupes animals given twice and in herd + animals", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "S1", type: "sheep" });
    const a2 = await createAnimal(jwt, { name: "S2", type: "sheep" });
    const herd = await createHerd(jwt, { name: "Flock", animalIds: [a1.id, a2.id], effectiveDate: "2025-01-01" });

    const famacha = await createCheck(jwt, {
      date: "2025-06-01",
      method: "famacha",
      herdId: herd.id,
      animals: [{ animalId: a1.id, famachaScore: 3 }, { animalId: a1.id }],
    });
    expect(famacha.status).toBe(200);
    expect(famacha.body.data.animals).toHaveLength(1);
    expect(famacha.body.data.animals[0].famachaScore).toBe(3);

    const fec = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      herdId: herd.id,
      fecSamples: [{ animalIds: [a1.id, a1.id], results: [{ parasiteType: "strongyles", countPerGram: 100 }] }],
    });
    expect(fec.status).toBe(200);
    expect(fec.body.data.fecSamples[0].animalIds).toEqual([a1.id]);
    expect(fec.body.data.fecSamples[0].pooled).toBe(false);

    const duplicateParasite = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      herdId: herd.id,
      fecSamples: [
        {
          animalIds: [a1.id],
          results: [
            { parasiteType: "strongyles", countPerGram: 100 },
            { parasiteType: "strongyles", countPerGram: 200 },
          ],
        },
      ],
    });
    expect(duplicateParasite.status).toBe(400);
  });

  it("rejects a check without animals and herd", async () => {
    const { jwt } = await createUserWithFarm();
    const { status } = await createCheck(jwt, { date: "2025-06-01", method: "famacha" });
    expect(status).toBe(400);
  });

  it("creates a fecal egg count check with individual and pooled samples", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "S1", type: "sheep" });
    const a2 = await createAnimal(jwt, { name: "S2", type: "sheep" });
    const a3 = await createAnimal(jwt, { name: "S3", type: "sheep" });

    const { status, body } = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      labName: "Vet Lab",
      animals: [{ animalId: a1.id }, { animalId: a2.id }, { animalId: a3.id }],
      fecSamples: [
        { label: "Ind-1", animalIds: [a1.id], results: [{ parasiteType: "strongyles", countPerGram: 800 }] },
        {
          label: "Pool-1",
          animalIds: [a2.id, a3.id],
          results: [
            { parasiteType: "strongyles", countPerGram: 400 },
            { parasiteType: "coccidia", countPerGram: 150 },
          ],
        },
      ],
    });
    expect(status).toBe(200);
    expect(body.data.fecSamples).toHaveLength(2);
    expect(body.data.fecSamples.find((sample) => sample.pooled)!.animalIds).toHaveLength(2);
    const strongyles = body.data.summary.fecByParasite.find((entry) => entry.parasiteType === "strongyles")!;
    expect(strongyles.sampleCount).toBe(2);
    expect(strongyles.avgCountPerGram).toBe(600);

    const historyRes = await request("GET", `/v1/animals/byId/${a3.id}/parasiteHistory`, undefined, jwt);
    const historyBody = (await historyRes.json()) as {
      data: { fecResults: Array<{ pooled: boolean; poolSize: number; results: Array<{ parasiteType: string }> }> };
    };
    expect(historyBody.data.fecResults).toHaveLength(1);
    expect(historyBody.data.fecResults[0].pooled).toBe(true);
    expect(historyBody.data.fecResults[0].poolSize).toBe(2);
  });

  it("validates check consistency", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "S1", type: "sheep" });
    const a2 = await createAnimal(jwt, { name: "S2", type: "sheep" });

    // Sample animal not part of the check
    const foreignSample = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      animals: [{ animalId: a1.id }],
      fecSamples: [{ animalIds: [a2.id], results: [{ parasiteType: "strongyles", countPerGram: 100 }] }],
    });
    expect(foreignSample.status).toBe(400);

    // Same animal in two samples
    const animalInTwoSamples = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      animals: [{ animalId: a1.id }, { animalId: a2.id }],
      fecSamples: [
        { animalIds: [a1.id, a2.id], results: [{ parasiteType: "strongyles", countPerGram: 100 }] },
        { animalIds: [a1.id], results: [{ parasiteType: "strongyles", countPerGram: 200 }] },
      ],
    });
    expect(animalInTwoSamples.status).toBe(400);

    // FAMACHA score on a fecal egg count check
    const scoreOnFec = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      animals: [{ animalId: a1.id, famachaScore: 3 }],
    });
    expect(scoreOnFec.status).toBe(400);

    // Score out of range
    const outOfRange = await createCheck(jwt, {
      date: "2025-06-01",
      method: "famacha",
      animals: [{ animalId: a1.id, famachaScore: 6 }],
    });
    expect(outOfRange.status).toBe(400);

    // Nothing was persisted
    const db = getAdminDb();
    const checks = await db.query.parasiteChecks.findMany();
    expect(checks).toHaveLength(0);
  });

  it("creates a follow-up task only when requested", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "S1", type: "sheep" });
    const herd = await createHerd(jwt, { name: "Flock", animalIds: [a1.id], effectiveDate: "2025-01-01" });

    const { status, body } = await createCheck(jwt, {
      date: "2025-06-01",
      method: "famacha",
      herdId: herd.id,
      followUp: { dueDate: "2025-06-15" },
    });
    expect(status).toBe(200);
    expect(body.data.followUpTasks).toHaveLength(1);
    expect(body.data.followUpTasks[0].dueDate).toMatch(/^2025-06-15/);

    const db = getAdminDb();
    const links = await db.query.taskLinks.findMany({ where: { taskId: body.data.followUpTasks[0].id } });
    expect(links.map((link) => link.linkType).sort()).toEqual(["herd", "parasite_check"]);

    const taskRes = await request("GET", `/v1/tasks/byId/${body.data.followUpTasks[0].id}`, undefined, jwt);
    expect(taskRes.status).toBe(200);
    const taskBody = (await taskRes.json()) as {
      data: { links: Array<{ linkType: string; displayName: string | null }> };
    };
    const checkLink = taskBody.data.links.find((link) => link.linkType === "parasite_check")!;
    expect(checkLink.displayName).toBe("FAMACHA · 2025-06-01 · Flock");

    await createCheck(jwt, { date: "2025-07-01", method: "famacha", herdId: herd.id });
    const tasks = await db.query.tasks.findMany();
    expect(tasks).toHaveLength(1);
  });

  it("links a treatment and computes reduction on re-check", async () => {
    const { jwt, farmId } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "S1", type: "sheep" });
    const a2 = await createAnimal(jwt, { name: "S2", type: "sheep" });
    const herd = await createHerd(jwt, { name: "Flock", animalIds: [a1.id, a2.id], effectiveDate: "2025-01-01" });
    const treatment = await createTreatment(jwt, [a1.id, a2.id], { name: "Dewormer" });

    const before = await createCheck(jwt, {
      date: "2025-06-01",
      method: "fecal_egg_count",
      herdId: herd.id,
      treatmentId: treatment.id,
      fecSamples: [{ animalIds: [a1.id, a2.id], results: [{ parasiteType: "strongyles", countPerGram: 1000 }] }],
    });
    expect(before.status).toBe(200);
    expect(before.body.data.treatmentId).toBe(treatment.id);

    const after = await createCheck(jwt, {
      date: "2025-06-15",
      method: "fecal_egg_count",
      herdId: herd.id,
      previousCheckId: before.body.data.id,
      fecSamples: [{ animalIds: [a1.id, a2.id], results: [{ parasiteType: "strongyles", countPerGram: 50 }] }],
    });
    expect(after.status).toBe(200);
    expect(after.body.data.comparisonToPrevious!.previousCheckId).toBe(before.body.data.id);
    expect(after.body.data.comparisonToPrevious!.fecReduction[0].reductionPercent).toBeCloseTo(95);

    // The original check lists its re-checks with the reduction against it
    const beforeRes = await request("GET", `/v1/parasiteChecks/byId/${before.body.data.id}`, undefined, jwt);
    const beforeBody = (await beforeRes.json()) as {
      data: { rechecks: Array<{ id: string; fecReduction: Array<{ reductionPercent: number | null }> }> };
    };
    expect(beforeBody.data.rechecks).toHaveLength(1);
    expect(beforeBody.data.rechecks[0].id).toBe(after.body.data.id);
    expect(beforeBody.data.rechecks[0].fecReduction[0].reductionPercent).toBeCloseTo(95);

    // Re-checks are not chained: a re-check of a re-check is rejected
    const chained = await createCheck(jwt, {
      date: "2025-07-01",
      method: "fecal_egg_count",
      herdId: herd.id,
      previousCheckId: after.body.data.id,
    });
    expect(chained.status).toBe(400);

    // A base check with re-checks cannot become a re-check itself
    const other = await createCheck(jwt, { date: "2025-05-01", method: "fecal_egg_count", herdId: herd.id });
    const baseToRecheck = await request(
      "PATCH",
      `/v1/parasiteChecks/byId/${before.body.data.id}`,
      { previousCheckId: other.body.data.id },
      jwt
    );
    expect(baseToRecheck.status).toBe(400);

    // A re-check repeats the base measurement: same method, same herd, only base animals
    const otherMethod = await createCheck(jwt, {
      date: "2025-06-20",
      method: "famacha",
      herdId: herd.id,
      previousCheckId: before.body.data.id,
    });
    expect(otherMethod.status).toBe(400);
    const otherHerd = await createHerd(jwt, { name: "Other", animalIds: [], effectiveDate: "2025-01-01" });
    const differentHerd = await createCheck(jwt, {
      date: "2025-06-20",
      method: "fecal_egg_count",
      herdId: otherHerd.id,
      animals: [{ animalId: a1.id }],
      previousCheckId: before.body.data.id,
    });
    expect(differentHerd.status).toBe(400);
    const newcomer = await createAnimal(jwt, { name: "Newcomer", type: "sheep" });
    const foreignAnimal = await createCheck(jwt, {
      date: "2025-06-20",
      method: "fecal_egg_count",
      herdId: herd.id,
      animals: [{ animalId: a1.id }, { animalId: newcomer.id }],
      previousCheckId: before.body.data.id,
    });
    expect(foreignAnimal.status).toBe(400);
    const subset = await createCheck(jwt, {
      date: "2025-06-20",
      method: "fecal_egg_count",
      herdId: herd.id,
      animals: [{ animalId: a1.id }],
      previousCheckId: before.body.data.id,
    });
    expect(subset.status).toBe(200);

    // The herd of a base check with re-checks is locked
    const changeBaseHerd = await request(
      "PATCH",
      `/v1/parasiteChecks/byId/${before.body.data.id}`,
      { herdId: otherHerd.id },
      jwt
    );
    expect(changeBaseHerd.status).toBe(400);

    // Herd overview also contains the comparison
    const overviewRes = await request(
      "GET",
      `/v1/animals/herds/byId/${herd.id}/parasiteOverview?from=2025-06-10`,
      undefined,
      jwt,
      farmId
    );
    expect(overviewRes.status).toBe(200);
    const overviewBody = (await overviewRes.json()) as { data: { count: number; result: CheckResponse[] } };
    // The re-check from 06-15 and the subset re-check from 06-20
    expect(overviewBody.data.count).toBe(2);
    const afterInOverview = overviewBody.data.result.find((check) => check.id === after.body.data.id)!;
    expect(afterInOverview.comparisonToPrevious!.fecReduction[0].reductionPercent).toBeCloseTo(95);

    // Animal history includes the linked treatment, but not unrelated ones
    const unrelatedTreatment = await createTreatment(jwt, [a1.id], { name: "Antibiotic" });
    const historyRes = await request("GET", `/v1/animals/byId/${a1.id}/parasiteHistory`, undefined, jwt);
    const historyBody = (await historyRes.json()) as { data: { treatments: Array<{ id: string }> } };
    const historyTreatmentIds = historyBody.data.treatments.map((entry) => entry.id);
    expect(historyTreatmentIds).toContain(treatment.id);
    expect(historyTreatmentIds).not.toContain(unrelatedTreatment.id);
  });

  it("updates and deletes a check", async () => {
    const { jwt } = await createUserWithFarm();
    const a1 = await createAnimal(jwt, { name: "S1", type: "sheep" });
    const a2 = await createAnimal(jwt, { name: "S2", type: "sheep" });
    const { body } = await createCheck(jwt, {
      date: "2025-06-01",
      method: "famacha",
      animals: [{ animalId: a1.id, famachaScore: 2 }],
    });

    const patchRes = await request(
      "PATCH",
      `/v1/parasiteChecks/byId/${body.data.id}`,
      {
        notes: "Rainy season",
        animals: [
          { animalId: a1.id, famachaScore: 3 },
          { animalId: a2.id, famachaScore: 5 },
        ],
      },
      jwt
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { data: CheckResponse & { notes: string | null } };
    expect(patchBody.data.notes).toBe("Rainy season");
    expect(patchBody.data.summary.famachaAverage).toBe(4);

    const deleteRes = await request("DELETE", `/v1/parasiteChecks/byId/${body.data.id}`, undefined, jwt);
    expect(deleteRes.status).toBe(200);
    const getRes = await request("GET", `/v1/parasiteChecks/byId/${body.data.id}`, undefined, jwt);
    expect(getRes.status).toBe(404);
  });

  it("denies cross-farm access", async () => {
    const owner = await createUserWithFarm({}, "owner@test.com");
    const other = await createUserWithFarm({ name: "Other Farm" }, "other@test.com");
    const ownerAnimal = await createAnimal(owner.jwt, { name: "Mine", type: "sheep" });
    const ownerHerd = await createHerd(owner.jwt, { name: "Mine", animalIds: [ownerAnimal.id] });
    const { body } = await createCheck(owner.jwt, {
      date: "2025-06-01",
      method: "famacha",
      animals: [{ animalId: ownerAnimal.id, famachaScore: 1 }],
    });

    const getRes = await request("GET", `/v1/parasiteChecks/byId/${body.data.id}`, undefined, other.jwt);
    expect(getRes.status).toBe(404);

    const deleteRes = await request("DELETE", `/v1/parasiteChecks/byId/${body.data.id}`, undefined, other.jwt);
    expect(deleteRes.status).toBe(404);

    // Referencing another farm's animal or herd is rejected
    const foreignAnimal = await createCheck(other.jwt, {
      date: "2025-06-01",
      method: "famacha",
      animals: [{ animalId: ownerAnimal.id }],
    });
    expect(foreignAnimal.status).toBe(404);
    const foreignHerd = await createCheck(other.jwt, { date: "2025-06-01", method: "famacha", herdId: ownerHerd.id });
    expect(foreignHerd.status).toBe(404);

    const historyRes = await request("GET", `/v1/animals/byId/${ownerAnimal.id}/parasiteHistory`, undefined, other.jwt);
    expect(historyRes.status).toBe(404);
  });
});
