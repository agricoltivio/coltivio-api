import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { TFunction } from "i18next";
import createHttpError from "http-errors";
import { RlsDb, Transaction } from "../db/db";
import {
  animals,
  currentFarmId,
  farmIdColumnValue,
  farmMembers,
  herdMemberships,
  parasiteCheckAnimals,
  parasiteChecks,
  parasiteFecResults,
  parasiteFecSampleAnimals,
  parasiteFecSamples,
  taskLinks,
  tasks,
} from "../db/schema";

export type ParasiteCheck = typeof parasiteChecks.$inferSelect;
export type ParasiteCheckMethod = ParasiteCheck["method"];
export type ParasiteType = typeof parasiteFecResults.$inferSelect.parasiteType;

export type ParasiteFecSampleInput = {
  label?: string | null;
  animalIds: string[];
  results: { parasiteType: ParasiteType; countPerGram: number }[];
};

export type ParasiteCheckAnimalInput = {
  animalId: string;
  famachaScore?: number | null;
};

export type ParasiteCheckFollowUpInput = {
  dueDate: Date;
  name?: string;
  assigneeId?: string;
};

export type ParasiteCheckCreateInput = {
  date: Date;
  method: ParasiteCheckMethod;
  herdId?: string | null;
  // Omitted → current members of `herdId` at the check date are used
  animals?: ParasiteCheckAnimalInput[];
  fecSamples?: ParasiteFecSampleInput[];
  labName?: string | null;
  notes?: string | null;
  previousCheckId?: string | null;
  treatmentId?: string | null;
  followUp?: ParasiteCheckFollowUpInput;
};

// animals/fecSamples: undefined = keep as-is, array = replace all
export type ParasiteCheckUpdateInput = Partial<Omit<ParasiteCheckCreateInput, "followUp">>;

export type ParasiteCheckListFilters = {
  herdId?: string;
  animalId?: string;
  from?: Date;
  to?: Date;
};

export type FecParasiteSummary = {
  parasiteType: ParasiteType;
  sampleCount: number;
  minCountPerGram: number;
  avgCountPerGram: number;
  maxCountPerGram: number;
};

export type ParasiteCheckSummary = {
  animalCount: number;
  famachaAverage: number | null;
  famachaDistribution: { score: number; count: number }[];
  fecByParasite: FecParasiteSummary[];
};

export type ParasiteCheckComparison = {
  previousCheckId: string;
  previousDate: Date;
  famachaAverageChange: number | null;
  // Fecal egg count reduction per parasite: (1 - after/before) * 100
  fecReduction: {
    parasiteType: ParasiteType;
    beforeAvgCountPerGram: number;
    afterAvgCountPerGram: number;
    // Number of samples the after average is based on (> 1 = average of individual samples)
    afterSampleCount: number;
    reductionPercent: number | null;
  }[];
};

export type ParasiteCheckDetail = ParasiteCheck & {
  herd: { id: string; name: string } | null;
  treatment: { id: string; name: string; startDate: Date } | null;
  animals: { animalId: string; name: string; earTagNumber: string | null; famachaScore: number | null }[];
  fecSamples: {
    id: string;
    label: string | null;
    pooled: boolean;
    animalIds: string[];
    results: { parasiteType: ParasiteType; countPerGram: number }[];
  }[];
  followUpTasks: { id: string; name: string; dueDate: Date | null; status: "todo" | "done" }[];
  summary: ParasiteCheckSummary;
  comparisonToPrevious: ParasiteCheckComparison | null;
  // Later checks that follow up on this one, compared against this check
  rechecks: {
    id: string;
    date: Date;
    method: ParasiteCheckMethod;
    treatment: { id: string; name: string; startDate: Date } | null;
    // Per-animal FAMACHA scores and their average, for charting the re-check
    animals: { animalId: string; famachaScore: number | null }[];
    famachaAverage: number | null;
    famachaAverageChange: number | null;
    fecReduction: ParasiteCheckComparison["fecReduction"];
  }[];
};

export type AnimalParasiteHistory = {
  checks: { checkId: string; date: Date; method: ParasiteCheckMethod; famachaScore: number | null }[];
  fecResults: {
    checkId: string;
    sampleId: string;
    date: Date;
    pooled: boolean;
    poolSize: number;
    results: { parasiteType: ParasiteType; countPerGram: number }[];
  }[];
  treatments: { id: string; name: string; startDate: Date; endDate: Date; drugName: string | null }[];
};

const checkWith = {
  herd: true,
  treatment: true,
  animals: { with: { animal: { with: { earTag: true } } } },
  fecSamples: { with: { animals: true, results: true } },
} as const;

type LoadedCheck = NonNullable<Awaited<ReturnType<typeof loadCheck>>>;

function loadCheck(tx: Transaction, id: string) {
  return tx.query.parasiteChecks.findFirst({ where: { id }, with: checkWith });
}

function summarizeCheck(check: LoadedCheck): ParasiteCheckSummary {
  const famachaScores = check.animals.flatMap((checkAnimal) =>
    checkAnimal.famachaScore === null ? [] : [checkAnimal.famachaScore]
  );
  const famachaDistribution = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: famachaScores.filter((famachaScore) => famachaScore === score).length,
  }));

  const countPerGramByParasite = new Map<ParasiteType, number[]>();
  for (const sample of check.fecSamples) {
    for (const result of sample.results) {
      const values = countPerGramByParasite.get(result.parasiteType) ?? [];
      values.push(result.countPerGram);
      countPerGramByParasite.set(result.parasiteType, values);
    }
  }
  const fecByParasite = [...countPerGramByParasite.entries()].map(([parasiteType, values]) => ({
    parasiteType,
    sampleCount: values.length,
    minCountPerGram: Math.min(...values),
    avgCountPerGram: values.reduce((sum, value) => sum + value, 0) / values.length,
    maxCountPerGram: Math.max(...values),
  }));

  return {
    animalCount: check.animals.length,
    famachaAverage:
      famachaScores.length > 0 ? famachaScores.reduce((sum, score) => sum + score, 0) / famachaScores.length : null,
    famachaDistribution,
    fecByParasite,
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Compares a re-check with its base check. Only like is compared with like, so a
// smaller re-check group doesn't show a reduction that isn't there:
// - FAMACHA: average change over the animals scored in both checks
// - individual samples: only animals with a result in both checks
// - pooled vs pooled: the pooled values
// - pooled vs individual: no reduction percent
function compareToPrevious(recheck: LoadedCheck, baseCheck: LoadedCheck): ParasiteCheckComparison {
  const baseScores = new Map<string, number>();
  for (const baseAnimal of baseCheck.animals) {
    if (baseAnimal.famachaScore !== null) baseScores.set(baseAnimal.animalId, baseAnimal.famachaScore);
  }
  const scorePairs = recheck.animals.flatMap((recheckAnimal) => {
    const before = baseScores.get(recheckAnimal.animalId);
    return recheckAnimal.famachaScore !== null && before !== undefined
      ? [{ before, after: recheckAnimal.famachaScore }]
      : [];
  });

  const recheckParasiteTypes = [
    ...new Set(recheck.fecSamples.flatMap((sample) => sample.results.map((result) => result.parasiteType))),
  ];
  const fecReduction = recheckParasiteTypes.flatMap((parasiteType) => {
    const samplesWithType = (check: LoadedCheck) =>
      check.fecSamples.flatMap((sample) => {
        const result = sample.results.find((entry) => entry.parasiteType === parasiteType);
        return result
          ? [
              {
                pooled: sample.animals.length > 1,
                animalIds: sample.animals.map((sampleAnimal) => sampleAnimal.animalId),
                countPerGram: result.countPerGram,
              },
            ]
          : [];
      });
    const afterSamples = samplesWithType(recheck);
    const beforeSamples = samplesWithType(baseCheck);
    if (afterSamples.length === 0 || beforeSamples.length === 0) return [];

    const afterPooled = afterSamples.some((sample) => sample.pooled);
    const beforePooled = beforeSamples.some((sample) => sample.pooled);

    let beforeValues = beforeSamples.map((sample) => sample.countPerGram);
    let afterValues = afterSamples.map((sample) => sample.countPerGram);
    const comparable = afterPooled === beforePooled;
    if (!afterPooled && !beforePooled) {
      // Individual samples: pair up results of the same animal
      const beforeByAnimal = new Map(beforeSamples.map((sample) => [sample.animalIds[0], sample.countPerGram]));
      const pairs = afterSamples.flatMap((sample) => {
        const before = beforeByAnimal.get(sample.animalIds[0]);
        return before !== undefined ? [{ before, after: sample.countPerGram }] : [];
      });
      if (pairs.length === 0) return [];
      beforeValues = pairs.map((pair) => pair.before);
      afterValues = pairs.map((pair) => pair.after);
    }

    const beforeAverage = average(beforeValues);
    const afterAverage = average(afterValues);
    return [
      {
        parasiteType,
        beforeAvgCountPerGram: beforeAverage,
        afterAvgCountPerGram: afterAverage,
        afterSampleCount: afterValues.length,
        reductionPercent: comparable && beforeAverage > 0 ? (1 - afterAverage / beforeAverage) * 100 : null,
      },
    ];
  });

  return {
    previousCheckId: baseCheck.id,
    previousDate: baseCheck.date,
    famachaAverageChange:
      scorePairs.length > 0
        ? average(scorePairs.map((pair) => pair.after)) - average(scorePairs.map((pair) => pair.before))
        : null,
    fecReduction,
  };
}

// Builds API responses for loaded checks, including comparison to previous checks and linked follow-up tasks
async function toDetails(tx: Transaction, checks: LoadedCheck[]): Promise<ParasiteCheckDetail[]> {
  if (checks.length === 0) return [];

  // Previous checks may be outside the requested filter, load the missing ones
  const loadedCheckIds = new Set(checks.map((check) => check.id));
  const missingPreviousIds = [
    ...new Set(checks.flatMap((check) => (check.previousCheckId ? [check.previousCheckId] : []))),
  ].filter((previousId) => !loadedCheckIds.has(previousId));
  const missingPreviousChecks =
    missingPreviousIds.length > 0
      ? await tx.query.parasiteChecks.findMany({ where: { id: { in: missingPreviousIds } }, with: checkWith })
      : [];
  const checksById = new Map([...checks, ...missingPreviousChecks].map((check) => [check.id, check]));

  const rechecks = await tx.query.parasiteChecks.findMany({
    where: { previousCheckId: { in: checks.map((check) => check.id) } },
    with: checkWith,
    orderBy: { date: "asc", createdAt: "asc" },
  });

  const followUpTaskRows = await tx
    .select({
      checkId: taskLinks.linkedId,
      id: tasks.id,
      name: tasks.name,
      dueDate: tasks.dueDate,
      status: tasks.status,
    })
    .from(taskLinks)
    .innerJoin(tasks, eq(tasks.id, taskLinks.taskId))
    .where(
      and(
        eq(taskLinks.linkType, "parasite_check"),
        inArray(
          taskLinks.linkedId,
          checks.map((check) => check.id)
        )
      )
    );

  return checks.map((check) => {
    const summary = summarizeCheck(check);
    const previousCheck = check.previousCheckId ? checksById.get(check.previousCheckId) : undefined;
    const { herd, treatment, animals: checkAnimals, fecSamples, ...checkColumns } = check;

    return {
      ...checkColumns,
      herd: herd ? { id: herd.id, name: herd.name } : null,
      treatment: treatment ? { id: treatment.id, name: treatment.name, startDate: treatment.startDate } : null,
      animals: checkAnimals.map((checkAnimal) => ({
        animalId: checkAnimal.animalId,
        name: checkAnimal.animal.name,
        earTagNumber: checkAnimal.animal.earTag?.number ?? null,
        famachaScore: checkAnimal.famachaScore,
      })),
      fecSamples: fecSamples.map((sample) => ({
        id: sample.id,
        label: sample.label,
        pooled: sample.animals.length > 1,
        animalIds: sample.animals.map((sampleAnimal) => sampleAnimal.animalId),
        results: sample.results.map((result) => ({
          parasiteType: result.parasiteType,
          countPerGram: result.countPerGram,
        })),
      })),
      followUpTasks: followUpTaskRows
        .filter((taskRow) => taskRow.checkId === check.id)
        .map(({ checkId: _checkId, ...taskRow }) => taskRow),
      summary,
      comparisonToPrevious: previousCheck ? compareToPrevious(check, previousCheck) : null,
      rechecks: rechecks
        .filter((recheck) => recheck.previousCheckId === check.id)
        .map((recheck) => {
          const recheckSummary = summarizeCheck(recheck);
          const comparison = compareToPrevious(recheck, check);
          return {
            id: recheck.id,
            date: recheck.date,
            method: recheck.method,
            treatment: recheck.treatment
              ? { id: recheck.treatment.id, name: recheck.treatment.name, startDate: recheck.treatment.startDate }
              : null,
            animals: recheck.animals.map((recheckAnimal) => ({
              animalId: recheckAnimal.animalId,
              famachaScore: recheckAnimal.famachaScore,
            })),
            famachaAverage: recheckSummary.famachaAverage,
            famachaAverageChange: comparison.famachaAverageChange,
            fecReduction: comparison.fecReduction,
          };
        }),
    };
  });
}

// Animals of a herd at a given date (membership active on that date, not dead before it)
async function resolveHerdAnimalIds(tx: Transaction, herdId: string, date: Date): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ animalId: herdMemberships.animalId })
    .from(herdMemberships)
    .innerJoin(animals, eq(animals.id, herdMemberships.animalId))
    .where(
      and(
        eq(herdMemberships.herdId, herdId),
        lte(herdMemberships.fromDate, date),
        or(isNull(herdMemberships.toDate), gte(herdMemberships.toDate, date)),
        or(isNull(animals.dateOfDeath), gte(animals.dateOfDeath, date))
      )
    );
  return rows.map((row) => row.animalId);
}

// FKs bypass RLS, so referenced ids must be checked explicitly to belong to the current farm
async function assertReferencesVisible(
  tx: Transaction,
  references: {
    herdId?: string | null;
    treatmentId?: string | null;
    previousCheckId?: string | null;
    animalIds: string[];
  }
) {
  if (references.herdId) {
    const herd = await tx.query.herds.findFirst({ where: { id: references.herdId } });
    if (!herd) throw createHttpError(404, "Herd not found");
  }
  if (references.treatmentId) {
    const treatment = await tx.query.treatments.findFirst({ where: { id: references.treatmentId } });
    if (!treatment) throw createHttpError(404, "Treatment not found");
  }
  if (references.previousCheckId) {
    const previousCheck = await tx.query.parasiteChecks.findFirst({ where: { id: references.previousCheckId } });
    if (!previousCheck) throw createHttpError(404, "Previous check not found");
  }
  const uniqueAnimalIds = [...new Set(references.animalIds)];
  if (uniqueAnimalIds.length > 0) {
    const visibleAnimals = await tx.query.animals.findMany({
      where: { id: { in: uniqueAnimalIds } },
      columns: { id: true },
    });
    if (visibleAnimals.length !== uniqueAnimalIds.length) throw createHttpError(404, "Animal not found");
  }
}

async function replaceCheckAnimals(tx: Transaction, checkId: string, checkAnimals: ParasiteCheckAnimalInput[]) {
  await tx.delete(parasiteCheckAnimals).where(eq(parasiteCheckAnimals.checkId, checkId));
  // Dedupe by animal; a given score wins over a missing one
  const checkAnimalsById = new Map<string, ParasiteCheckAnimalInput>();
  for (const checkAnimal of checkAnimals) {
    const existing = checkAnimalsById.get(checkAnimal.animalId);
    if (existing && existing.famachaScore != null && checkAnimal.famachaScore == null) continue;
    checkAnimalsById.set(checkAnimal.animalId, checkAnimal);
  }
  if (checkAnimalsById.size === 0) return;
  await tx.insert(parasiteCheckAnimals).values(
    [...checkAnimalsById.values()].map((checkAnimal) => ({
      ...farmIdColumnValue,
      checkId,
      animalId: checkAnimal.animalId,
      famachaScore: checkAnimal.famachaScore ?? null,
    }))
  );
}

async function replaceFecSamples(tx: Transaction, checkId: string, fecSamples: ParasiteFecSampleInput[]) {
  // Sample animals and results cascade
  await tx.delete(parasiteFecSamples).where(eq(parasiteFecSamples.checkId, checkId));
  for (const sampleInput of fecSamples) {
    const [sample] = await tx
      .insert(parasiteFecSamples)
      .values({ ...farmIdColumnValue, checkId, label: sampleInput.label ?? null })
      .returning();
    await tx
      .insert(parasiteFecSampleAnimals)
      .values(
        [...new Set(sampleInput.animalIds)].map((animalId) => ({ ...farmIdColumnValue, sampleId: sample.id, animalId }))
      );
    if (sampleInput.results.length > 0) {
      await tx.insert(parasiteFecResults).values(
        sampleInput.results.map((result) => ({
          ...farmIdColumnValue,
          sampleId: sample.id,
          parasiteType: result.parasiteType,
          countPerGram: result.countPerGram,
        }))
      );
    }
  }
}

// Re-checks always belong to a base check (not chained) and repeat its measurement:
// same method, same herd, only animals of the base check and not before it
async function assertRecheckLinkValid(tx: Transaction, check: LoadedCheck) {
  // A base check must stay in line with its re-checks
  const ownRechecks = await tx.query.parasiteChecks.findMany({
    where: { previousCheckId: check.id },
    with: { animals: true },
  });
  if (ownRechecks.length > 0) {
    if (check.previousCheckId) {
      throw createHttpError(400, "A check with re-checks cannot become a re-check");
    }
    if (ownRechecks.some((recheck) => recheck.method !== check.method || recheck.herdId !== check.herdId)) {
      throw createHttpError(400, "Method and herd of a check with re-checks cannot be changed");
    }
    const checkAnimalIds = new Set(check.animals.map((checkAnimal) => checkAnimal.animalId));
    const recheckHasForeignAnimal = ownRechecks.some((recheck) =>
      recheck.animals.some((recheckAnimal) => !checkAnimalIds.has(recheckAnimal.animalId))
    );
    if (recheckHasForeignAnimal) {
      throw createHttpError(400, "Animals of a check with re-checks cannot be removed");
    }
    if (ownRechecks.some((recheck) => recheck.date < check.date)) {
      throw createHttpError(400, "A check cannot be dated after its re-checks");
    }
  }

  if (!check.previousCheckId) return;
  // Locks the base check so it cannot become a re-check or change concurrently
  const [baseCheck] = await tx
    .select()
    .from(parasiteChecks)
    .where(eq(parasiteChecks.id, check.previousCheckId))
    .for("update");
  if (!baseCheck) throw createHttpError(404, "Previous check not found");
  if (baseCheck.previousCheckId) {
    throw createHttpError(400, "A re-check can only follow up on a base check");
  }
  if (baseCheck.method !== check.method) {
    throw createHttpError(400, "A re-check must use the same method as its base check");
  }
  if (baseCheck.herdId !== check.herdId) {
    throw createHttpError(400, "A re-check must be for the same herd as its base check");
  }
  if (check.date < baseCheck.date) {
    throw createHttpError(400, "A re-check cannot be dated before its base check");
  }
  const baseAnimals = await tx.query.parasiteCheckAnimals.findMany({ where: { checkId: baseCheck.id } });
  const baseAnimalIds = new Set(baseAnimals.map((baseAnimal) => baseAnimal.animalId));
  if (check.animals.some((checkAnimal) => !baseAnimalIds.has(checkAnimal.animalId))) {
    throw createHttpError(400, "A re-check can only include animals of its base check");
  }
}

// Validates the final state of a check after create/update (runs inside the transaction, throwing rolls back)
function assertCheckConsistent(check: LoadedCheck) {
  if (check.animals.length === 0) {
    throw createHttpError(400, "A check needs at least one animal");
  }
  if (check.method !== "famacha" && check.animals.some((checkAnimal) => checkAnimal.famachaScore !== null)) {
    throw createHttpError(400, "FAMACHA scores are only allowed for famacha checks");
  }
  if (check.method !== "fecal_egg_count" && check.fecSamples.length > 0) {
    throw createHttpError(400, "Fecal samples are only allowed for fecal_egg_count checks");
  }
  const checkAnimalIds = new Set(check.animals.map((checkAnimal) => checkAnimal.animalId));
  const sampleHasForeignAnimal = check.fecSamples.some((sample) =>
    sample.animals.some((sampleAnimal) => !checkAnimalIds.has(sampleAnimal.animalId))
  );
  if (sampleHasForeignAnimal) {
    throw createHttpError(400, "Fecal sample animals must be part of the check");
  }
  const sampleAnimalIds = check.fecSamples.flatMap((sample) =>
    sample.animals.map((sampleAnimal) => sampleAnimal.animalId)
  );
  if (new Set(sampleAnimalIds).size !== sampleAnimalIds.length) {
    throw createHttpError(400, "An animal can only be part of one fecal sample per check");
  }
}

export function parasiteChecksApi(rlsDb: RlsDb, t: TFunction) {
  return {
    async createCheck(input: ParasiteCheckCreateInput, userId: string): Promise<ParasiteCheckDetail> {
      if (!input.animals && !input.herdId) {
        throw createHttpError(400, "Either animals or herdId is required");
      }

      return rlsDb.rls(async (tx) => {
        await assertReferencesVisible(tx, {
          herdId: input.herdId,
          treatmentId: input.treatmentId,
          previousCheckId: input.previousCheckId,
          animalIds: [
            ...(input.animals ?? []).map((checkAnimal) => checkAnimal.animalId),
            ...(input.fecSamples ?? []).flatMap((sample) => sample.animalIds),
          ],
        });

        let checkAnimals: ParasiteCheckAnimalInput[] = input.animals ?? [];
        if (!input.animals && input.herdId) {
          const herdAnimalIds = await resolveHerdAnimalIds(tx, input.herdId, input.date);
          checkAnimals = herdAnimalIds.map((animalId) => ({ animalId }));
        }

        const [check] = await tx
          .insert(parasiteChecks)
          .values({
            ...farmIdColumnValue,
            date: input.date,
            method: input.method,
            herdId: input.herdId ?? null,
            labName: input.labName ?? null,
            notes: input.notes ?? null,
            previousCheckId: input.previousCheckId ?? null,
            treatmentId: input.treatmentId ?? null,
            createdBy: userId,
          })
          .returning();

        await replaceCheckAnimals(tx, check.id, checkAnimals);
        await replaceFecSamples(tx, check.id, input.fecSamples ?? []);

        const loadedCheck = await loadCheck(tx, check.id);
        if (!loadedCheck) throw createHttpError(404, "Parasite check not found");
        assertCheckConsistent(loadedCheck);
        await assertRecheckLinkValid(tx, loadedCheck);

        // Optional reminder to re-check (client-side toggle)
        if (input.followUp?.assigneeId) {
          const [assigneeMembership] = await tx
            .select({ id: farmMembers.id })
            .from(farmMembers)
            .where(and(eq(farmMembers.userId, input.followUp.assigneeId), eq(farmMembers.farmId, currentFarmId)));
          if (!assigneeMembership) throw createHttpError(404, "Assignee not found");
        }
        if (input.followUp) {
          const followUpName =
            input.followUp.name ??
            (loadedCheck.herd
              ? t("parasite_checks.follow_up_task_name_herd", { herd: loadedCheck.herd.name })
              : t("parasite_checks.follow_up_task_name"));
          const [task] = await tx
            .insert(tasks)
            .values({
              ...farmIdColumnValue,
              name: followUpName,
              dueDate: input.followUp.dueDate,
              assigneeId: input.followUp.assigneeId,
              createdBy: userId,
            })
            .returning();
          await tx
            .insert(taskLinks)
            .values({ ...farmIdColumnValue, taskId: task.id, linkType: "parasite_check", linkedId: check.id });
          if (check.herdId) {
            await tx
              .insert(taskLinks)
              .values({ ...farmIdColumnValue, taskId: task.id, linkType: "herd", linkedId: check.herdId });
          }
        }

        const [detail] = await toDetails(tx, [loadedCheck]);
        return detail;
      });
    },

    async getCheck(id: string): Promise<ParasiteCheckDetail | undefined> {
      return rlsDb.rls(async (tx) => {
        const check = await loadCheck(tx, id);
        if (!check) return undefined;
        const [detail] = await toDetails(tx, [check]);
        return detail;
      });
    },

    async listChecks(filters: ParasiteCheckListFilters): Promise<ParasiteCheckDetail[]> {
      return rlsDb.rls(async (tx) => {
        let checkIdsForAnimal: string[] | undefined;
        if (filters.animalId) {
          const rows = await tx
            .select({ checkId: parasiteCheckAnimals.checkId })
            .from(parasiteCheckAnimals)
            .where(eq(parasiteCheckAnimals.animalId, filters.animalId));
          checkIdsForAnimal = rows.map((row) => row.checkId);
          if (checkIdsForAnimal.length === 0) return [];
        }

        const checks = await tx.query.parasiteChecks.findMany({
          where: {
            ...(filters.herdId ? { herdId: filters.herdId } : {}),
            ...(checkIdsForAnimal ? { id: { in: checkIdsForAnimal } } : {}),
            ...(filters.from || filters.to
              ? {
                  date: {
                    ...(filters.from ? { gte: filters.from } : {}),
                    ...(filters.to ? { lte: filters.to } : {}),
                  },
                }
              : {}),
          },
          with: checkWith,
          orderBy: { date: "desc", createdAt: "desc" },
        });
        return toDetails(tx, checks);
      });
    },

    async updateCheck(id: string, input: ParasiteCheckUpdateInput): Promise<ParasiteCheckDetail> {
      return rlsDb.rls(async (tx) => {
        const existingCheck = await tx.query.parasiteChecks.findFirst({
          where: { id },
          with: { animals: true },
        });
        if (!existingCheck) throw createHttpError(404, "Parasite check not found");
        if (input.previousCheckId === id) {
          throw createHttpError(400, "A check cannot be its own previous check");
        }

        // A base check with re-checks keeps its method, herd and animals
        const hasRechecks = await tx.query.parasiteChecks.findFirst({ where: { previousCheckId: id } });
        if (hasRechecks) {
          const methodChanged = input.method !== undefined && input.method !== existingCheck.method;
          const herdChanged = input.herdId !== undefined && (input.herdId ?? null) !== existingCheck.herdId;
          const existingAnimalIds = new Set(existingCheck.animals.map((checkAnimal) => checkAnimal.animalId));
          const inputAnimalIds = new Set((input.animals ?? []).map((checkAnimal) => checkAnimal.animalId));
          const animalsChanged =
            input.animals !== undefined &&
            (inputAnimalIds.size !== existingAnimalIds.size ||
              [...inputAnimalIds].some((animalId) => !existingAnimalIds.has(animalId)));
          if (methodChanged || herdChanged || animalsChanged) {
            throw createHttpError(400, "Method, herd and animals of a check with re-checks cannot be changed");
          }
        }

        await assertReferencesVisible(tx, {
          herdId: input.herdId,
          treatmentId: input.treatmentId,
          previousCheckId: input.previousCheckId,
          animalIds: [
            ...(input.animals ?? []).map((checkAnimal) => checkAnimal.animalId),
            ...(input.fecSamples ?? []).flatMap((sample) => sample.animalIds),
          ],
        });

        const { animals: checkAnimals, fecSamples, ...checkColumns } = input;
        await tx
          .update(parasiteChecks)
          .set({ ...checkColumns, updatedAt: new Date() })
          .where(eq(parasiteChecks.id, id));

        if (checkAnimals !== undefined) await replaceCheckAnimals(tx, id, checkAnimals);
        if (fecSamples !== undefined) await replaceFecSamples(tx, id, fecSamples);

        const loadedCheck = await loadCheck(tx, id);
        if (!loadedCheck) throw createHttpError(404, "Parasite check not found");
        assertCheckConsistent(loadedCheck);
        await assertRecheckLinkValid(tx, loadedCheck);

        const [detail] = await toDetails(tx, [loadedCheck]);
        return detail;
      });
    },

    async deleteCheck(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        const deleted = await tx.delete(parasiteChecks).where(eq(parasiteChecks.id, id)).returning();
        if (deleted.length === 0) throw createHttpError(404, "Parasite check not found");
      });
    },

    async getAnimalParasiteHistory(
      animalId: string,
      range: { from?: Date; to?: Date }
    ): Promise<AnimalParasiteHistory> {
      return rlsDb.rls(async (tx) => {
        const animal = await tx.query.animals.findFirst({ where: { id: animalId }, columns: { id: true } });
        if (!animal) throw createHttpError(404, "Animal not found");

        const isInRange = (date: Date) => (!range.from || date >= range.from) && (!range.to || date <= range.to);

        const checkRows = await tx.query.parasiteCheckAnimals.findMany({
          where: { animalId },
          with: { check: true },
        });
        const checks = checkRows
          .filter((row) => isInRange(row.check.date))
          .map((row) => ({
            checkId: row.checkId,
            date: row.check.date,
            method: row.check.method,
            famachaScore: row.famachaScore,
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        const sampleRows = await tx.query.parasiteFecSampleAnimals.findMany({
          where: { animalId },
          with: { sample: { with: { check: true, animals: true, results: true } } },
        });
        const fecResults = sampleRows
          .filter((row) => isInRange(row.sample.check.date))
          .map((row) => ({
            checkId: row.sample.checkId,
            sampleId: row.sampleId,
            date: row.sample.check.date,
            pooled: row.sample.animals.length > 1,
            poolSize: row.sample.animals.length,
            results: row.sample.results.map((result) => ({
              parasiteType: result.parasiteType,
              countPerGram: result.countPerGram,
            })),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        // Only treatments linked to a parasite check of this animal, and only if the
        // animal was part of the treatment (selective deworming treats just some)
        const linkedTreatmentIds = new Set(
          checkRows.flatMap((row) => (row.check.treatmentId ? [row.check.treatmentId] : []))
        );
        const treatmentRows =
          linkedTreatmentIds.size > 0
            ? await tx.query.animalTreatments.findMany({
                where: { animalId, treatmentId: { in: [...linkedTreatmentIds] } },
                with: { treatment: { with: { drug: true } } },
              })
            : [];
        const treatments = treatmentRows
          .filter((row) => isInRange(row.treatment.startDate))
          .map((row) => ({
            id: row.treatment.id,
            name: row.treatment.name,
            startDate: row.treatment.startDate,
            endDate: row.treatment.endDate,
            drugName: row.treatment.drug?.name ?? null,
          }))
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        return { checks, fecResults, treatments };
      });
    },
  };
}
