import { addDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import type { Animal } from "../animals/animals";
import { RlsDb, Transaction } from "../db/db";
import { animalTreatments, farmIdColumnValue, treatments } from "../db/schema";
import type { DrugWithTreatment } from "../drugs/drugs";

// Client-provided weight per animal, overrides the weight looked up from the animal's weight history
export type AnimalWeightOverride = { animalId: string; weightKg: number | null };
// Client-provided effective amount per animal, overrides the amount computed from dose and weight
export type EffectiveDoseOverride = { animalId: string; effectiveDoseValue: number | null };

export type TreatmentCreateInput = Omit<typeof treatments.$inferInsert, "id" | "farmId" | "createdAt" | "createdBy"> & {
  animalIds: string[];
  animalWeights?: AnimalWeightOverride[];
  effectiveDoseOverrides?: EffectiveDoseOverride[];
};

export type TreatmentUpdateInput = Partial<Omit<TreatmentCreateInput, "drugId">>;

export type Treatment = typeof treatments.$inferSelect;

export type AnimalTreatmentDose = {
  animalId: string;
  animalWeightKg: number | null;
  effectiveDoseValue: number | null;
};

export type TreatmentWithRelations = Treatment & {
  animals: Animal[];
  animalDoses: AnimalTreatmentDose[];
  drug: DrugWithTreatment | null;
};

type DoseFields = Pick<Treatment, "startDate" | "drugDoseValue" | "drugDosePerUnit">;

// Resolves the weight of each animal (override, else previously stored weight, else the latest weight entry
// on or before the treatment start) and computes the effective amount for per-kg doses, unless the client
// entered the effective amount itself.
async function resolveAnimalDoses(
  tx: Transaction,
  animalIds: string[],
  doseFields: DoseFields,
  overrides: AnimalWeightOverride[] | undefined,
  storedWeightByAnimalId: Map<string, number | null>,
  effectiveDoseOverrides: EffectiveDoseOverride[] | undefined
): Promise<AnimalTreatmentDose[]> {
  const effectiveDoseOverrideByAnimalId = new Map(
    (effectiveDoseOverrides ?? []).map((override) => [override.animalId, override.effectiveDoseValue])
  );
  const overrideByAnimalId = new Map((overrides ?? []).map((override) => [override.animalId, override.weightKg]));
  const animalIdsToLookUp = animalIds.filter(
    (animalId) => !overrideByAnimalId.has(animalId) && storedWeightByAnimalId.get(animalId) == null
  );
  const latestWeightByAnimalId = new Map<string, number>();
  if (animalIdsToLookUp.length > 0) {
    const weights = await tx.query.animalWeights.findMany({
      where: { animalId: { in: animalIdsToLookUp }, date: { lte: doseFields.startDate } },
      orderBy: { date: "desc", createdAt: "desc" },
    });
    // Sorted newest first, so the first entry per animal wins
    for (const weight of weights) {
      if (!latestWeightByAnimalId.has(weight.animalId)) latestWeightByAnimalId.set(weight.animalId, weight.weightKg);
    }
  }

  return animalIds.map((animalId) => {
    const animalWeightKg = overrideByAnimalId.has(animalId)
      ? (overrideByAnimalId.get(animalId) ?? null)
      : (storedWeightByAnimalId.get(animalId) ?? latestWeightByAnimalId.get(animalId) ?? null);
    const computedEffectiveDoseValue =
      doseFields.drugDosePerUnit === "kg" && doseFields.drugDoseValue != null && animalWeightKg != null
        ? Math.round(doseFields.drugDoseValue * animalWeightKg * 1000) / 1000
        : null;
    const effectiveDoseValue = effectiveDoseOverrideByAnimalId.has(animalId)
      ? (effectiveDoseOverrideByAnimalId.get(animalId) ?? null)
      : computedEffectiveDoseValue;
    return { animalId, animalWeightKg, effectiveDoseValue };
  });
}

function toAnimalDoses(rows: { animalId: string; animalWeightKg: number | null; effectiveDoseValue: number | null }[]) {
  return rows.map(({ animalId, animalWeightKg, effectiveDoseValue }) => ({
    animalId,
    animalWeightKg,
    effectiveDoseValue,
  }));
}

export function treatmentsApi(rlsDb: RlsDb) {
  return {
    async createTreatment(treatmentInput: TreatmentCreateInput, userId: string): Promise<Treatment> {
      const { animalIds, animalWeights, effectiveDoseOverrides, ...treatmentData } = treatmentInput;

      return rlsDb.rls(async (tx) => {
        let milkUsableDate = treatmentData.milkUsableDate;
        let meatUsableDate = treatmentData.meatUsableDate;

        // If dates not provided and drug specified, auto-calculate based on first animal's type
        if (treatmentData.drugId && (!milkUsableDate || !meatUsableDate)) {
          const animal = await tx.query.animals.findFirst({
            where: { id: animalIds[0] },
          });

          if (!animal) {
            throw new Error("Animal not found");
          }

          const drugTreatmentData = await tx.query.drugTreatment.findFirst({
            where: {
              drugId: treatmentData.drugId,
              animalType: animal.type,
            },
          });
          if (!drugTreatmentData) {
            throw new Error(`No treatment data found for drug and animal type ${animal.type}`);
          }

          if (!milkUsableDate) {
            milkUsableDate = addDays(treatmentData.endDate, drugTreatmentData.milkWaitingDays);
          }
          if (!meatUsableDate) {
            meatUsableDate = addDays(treatmentData.endDate, drugTreatmentData.meatWaitingDays);
          }
        }

        // Insert treatment
        const [treatment] = await tx
          .insert(treatments)
          .values({
            ...farmIdColumnValue,
            ...treatmentData,
            milkUsableDate,
            meatUsableDate,
            createdBy: userId,
          })
          .returning();

        // Insert animal-treatment associations with the weight and effective amount at treatment time
        if (animalIds.length > 0) {
          const animalDoses = await resolveAnimalDoses(
            tx,
            animalIds,
            treatment,
            animalWeights,
            new Map(),
            effectiveDoseOverrides
          );
          await tx.insert(animalTreatments).values(
            animalDoses.map((animalDose) => ({
              ...farmIdColumnValue,
              ...animalDose,
              treatmentId: treatment.id,
            }))
          );
        }

        return treatment;
      });
    },

    async getTreatmentById(id: string): Promise<TreatmentWithRelations | undefined> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.treatments.findFirst({
          where: { id },
          with: {
            animalTreatments: {
              with: {
                animal: {
                  with: { earTag: true },
                },
              },
            },
            drug: {
              with: {
                drugTreatment: true,
              },
            },
          },
        });
        if (!result) return undefined;
        return {
          ...result,
          animals: result.animalTreatments.map((at) => at.animal),
          animalDoses: toAnimalDoses(result.animalTreatments),
        };
      });
    },

    async getTreatmentsForFarm(farmId: string): Promise<TreatmentWithRelations[]> {
      return rlsDb.rls(async (tx) => {
        const results = await tx.query.treatments.findMany({
          where: { farmId },
          with: {
            animalTreatments: {
              with: {
                animal: {
                  with: { earTag: true },
                },
              },
            },
            drug: {
              with: {
                drugTreatment: true,
              },
            },
          },
          orderBy: { startDate: "desc" },
        });
        return results.map((r) => ({
          ...r,
          animals: r.animalTreatments.map((at) => at.animal),
          animalDoses: toAnimalDoses(r.animalTreatments),
        }));
      });
    },

    async getTreatmentsForAnimal(animalId: string): Promise<TreatmentWithRelations[]> {
      return rlsDb.rls(async (tx) => {
        // Find treatments through the junction table
        const animalTreatmentRecords = await tx.query.animalTreatments.findMany({
          where: { animalId },
          with: {
            treatment: {
              with: {
                drug: {
                  with: { drugTreatment: true },
                },
                animalTreatments: {
                  with: {
                    animal: {
                      with: { earTag: true },
                    },
                  },
                },
              },
            },
          },
        });
        return animalTreatmentRecords
          .map((at) => ({
            ...at.treatment,
            animals: at.treatment.animalTreatments.map((at2) => at2.animal),
            animalDoses: toAnimalDoses(at.treatment.animalTreatments),
          }))
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      });
    },

    async updateTreatment(id: string, data: TreatmentUpdateInput): Promise<Treatment | undefined> {
      const { animalIds, animalWeights, effectiveDoseOverrides, ...treatmentData } = data;

      return rlsDb.rls(async (tx) => {
        const previousTreatment = await tx.query.treatments.findFirst({ where: { id } });
        // Drizzle rejects an empty update set, e.g. a PATCH that only changes animal weights or amounts
        const [treatment] =
          Object.keys(treatmentData).length > 0
            ? await tx.update(treatments).set(treatmentData).where(eq(treatments.id, id)).returning()
            : [previousTreatment];
        if (!treatment || !previousTreatment) return treatment;

        const existingRows = await tx.query.animalTreatments.findMany({ where: { treatmentId: id } });
        // Stored weights stay valid as long as the start date is unchanged, otherwise look them up again
        const startDateChanged = previousTreatment.startDate.getTime() !== treatment.startDate.getTime();
        const storedWeightByAnimalId = new Map(
          startDateChanged ? [] : existingRows.map((row) => [row.animalId, row.animalWeightKg])
        );
        const finalAnimalIds = animalIds ?? existingRows.map((row) => row.animalId);
        const animalDoses = await resolveAnimalDoses(
          tx,
          finalAnimalIds,
          treatment,
          animalWeights,
          storedWeightByAnimalId,
          effectiveDoseOverrides
        );

        if (animalIds !== undefined) {
          // Replace all animal associations
          await tx.delete(animalTreatments).where(eq(animalTreatments.treatmentId, id));
          if (animalDoses.length > 0) {
            await tx.insert(animalTreatments).values(
              animalDoses.map((animalDose) => ({
                ...farmIdColumnValue,
                ...animalDose,
                treatmentId: id,
              }))
            );
          }
        } else {
          for (const { animalId, animalWeightKg, effectiveDoseValue } of animalDoses) {
            await tx
              .update(animalTreatments)
              .set({ animalWeightKg, effectiveDoseValue })
              .where(and(eq(animalTreatments.treatmentId, id), eq(animalTreatments.animalId, animalId)));
          }
        }

        return treatment;
      });
    },

    async deleteTreatment(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(treatments).where(eq(treatments.id, id));
      });
    },
  };
}
