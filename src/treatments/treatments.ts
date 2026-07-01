import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import type { Animal } from "../animals/animals";
import { appDrizzle } from "../db/db";
import { animalTreatments, treatments } from "../db/schema";
import type { DrugWithTreatment } from "../drugs/drugs";

export type TreatmentCreateInput = Omit<typeof treatments.$inferInsert, "id" | "farmId" | "createdAt" | "createdBy"> & {
  animalIds: string[];
};

export type TreatmentUpdateInput = Partial<Omit<TreatmentCreateInput, "drugId">>;

export type Treatment = typeof treatments.$inferSelect;

export type TreatmentWithRelations = Treatment & {
  animals: Animal[];
  drug: DrugWithTreatment | null;
};

export async function createTreatment(
  treatmentInput: TreatmentCreateInput,
  userId: string,
  farmId: string
): Promise<Treatment> {
  const { animalIds, ...treatmentData } = treatmentInput;

  return appDrizzle.transaction(async (tx) => {
    let milkUsableDate = treatmentData.milkUsableDate;
    let meatUsableDate = treatmentData.meatUsableDate;

    if (treatmentData.drugId && (!milkUsableDate || !meatUsableDate)) {
      const animal = await tx.query.animals.findFirst({ where: { id: animalIds[0] } });
      if (!animal) throw new Error("Animal not found");

      const drugTreatmentData = await tx.query.drugTreatment.findFirst({
        where: { drugId: treatmentData.drugId, animalType: animal.type },
      });
      if (!drugTreatmentData) {
        throw new Error(`No treatment data found for drug and animal type ${animal.type}`);
      }

      if (!milkUsableDate) milkUsableDate = addDays(treatmentData.endDate, drugTreatmentData.milkWaitingDays);
      if (!meatUsableDate) meatUsableDate = addDays(treatmentData.endDate, drugTreatmentData.meatWaitingDays);
    }

    const [treatment] = await tx
      .insert(treatments)
      .values({ farmId, ...treatmentData, milkUsableDate, meatUsableDate, createdBy: userId })
      .returning();

    if (animalIds.length > 0) {
      await tx
        .insert(animalTreatments)
        .values(animalIds.map((animalId) => ({ farmId, animalId, treatmentId: treatment.id })));
    }

    return treatment;
  });
}

export async function getTreatmentById(id: string): Promise<TreatmentWithRelations | undefined> {
  const result = await appDrizzle.query.treatments.findFirst({
    where: { id },
    with: {
      animalTreatments: { with: { animal: { with: { earTag: true } } } },
      drug: { with: { drugTreatment: true } },
    },
  });
  if (!result) return undefined;
  return { ...result, animals: result.animalTreatments.map((at) => at.animal) };
}

export async function getTreatmentsForFarm(farmId: string): Promise<TreatmentWithRelations[]> {
  const results = await appDrizzle.query.treatments.findMany({
    where: { farmId },
    with: {
      animalTreatments: { with: { animal: { with: { earTag: true } } } },
      drug: { with: { drugTreatment: true } },
    },
    orderBy: { startDate: "desc" },
  });
  return results.map((r) => ({ ...r, animals: r.animalTreatments.map((at) => at.animal) }));
}

export async function getTreatmentsForAnimal(animalId: string): Promise<TreatmentWithRelations[]> {
  const records = await appDrizzle.query.animalTreatments.findMany({
    where: { animalId },
    with: {
      treatment: {
        with: {
          drug: { with: { drugTreatment: true } },
          animalTreatments: { with: { animal: { with: { earTag: true } } } },
        },
      },
    },
  });
  return records
    .map((at) => ({ ...at.treatment, animals: at.treatment.animalTreatments.map((at2) => at2.animal) }))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

export async function updateTreatment(id: string, data: TreatmentUpdateInput, farmId: string): Promise<Treatment> {
  const { animalIds, ...treatmentData } = data;

  return appDrizzle.transaction(async (tx) => {
    const [treatment] = await tx.update(treatments).set(treatmentData).where(eq(treatments.id, id)).returning();

    if (animalIds !== undefined) {
      await tx.delete(animalTreatments).where(eq(animalTreatments.treatmentId, id));
      if (animalIds.length > 0) {
        await tx.insert(animalTreatments).values(animalIds.map((animalId) => ({ farmId, animalId, treatmentId: id })));
      }
    }

    return treatment;
  });
}

export async function deleteTreatment(id: string): Promise<void> {
  await appDrizzle.delete(treatments).where(eq(treatments.id, id));
}
