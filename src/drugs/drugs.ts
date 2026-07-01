import { count, eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { drugs, drugTreatment, treatments } from "../db/schema";

export type DrugTreatmentCreateInput = Omit<typeof drugTreatment.$inferInsert, "id" | "drugId">;
export type DrugCreateInput = Omit<typeof drugs.$inferInsert, "id" | "farmId"> & {
  drugTreatment: DrugTreatmentCreateInput[];
};
export type DrugUpdateInput = Partial<Omit<DrugCreateInput, "drugTreatment">> & {
  drugTreatment?: DrugTreatmentCreateInput[];
};
export type Drug = typeof drugs.$inferSelect;
export type DrugTreatment = typeof drugTreatment.$inferSelect;
export type DrugWithTreatment = Drug & {
  drugTreatment: DrugTreatment[];
};

export async function createDrug(drugInput: DrugCreateInput, farmId: string): Promise<DrugWithTreatment> {
  return appDrizzle.transaction(async (tx) => {
    const { drugTreatment: drugTreatmentData, ...drugData } = drugInput;

    const [drug] = await tx
      .insert(drugs)
      .values({ farmId, ...drugData })
      .returning();

    if (drugTreatmentData && drugTreatmentData.length > 0) {
      await tx.insert(drugTreatment).values(drugTreatmentData.map((dt) => ({ drugId: drug.id, ...dt })));
    }

    const drugWithTreatment = await tx.query.drugs.findFirst({
      where: { id: drug.id },
      with: { drugTreatment: true },
    });

    return drugWithTreatment!;
  });
}

export async function getDrugById(id: string): Promise<DrugWithTreatment | undefined> {
  return appDrizzle.query.drugs.findFirst({
    where: { id },
    with: { drugTreatment: true },
  });
}

export async function getDrugsForFarm(farmId: string): Promise<DrugWithTreatment[]> {
  return appDrizzle.query.drugs.findMany({
    where: { farmId },
    with: { drugTreatment: true },
  });
}

export async function updateDrug(id: string, data: DrugUpdateInput): Promise<DrugWithTreatment> {
  return appDrizzle.transaction(async (tx) => {
    const { drugTreatment: drugTreatmentData, ...drugData } = data;

    if (Object.keys(drugData).length > 0) {
      await tx.update(drugs).set(drugData).where(eq(drugs.id, id));
    }

    if (drugTreatmentData) {
      await tx.delete(drugTreatment).where(eq(drugTreatment.drugId, id));
      if (drugTreatmentData.length > 0) {
        await tx.insert(drugTreatment).values(drugTreatmentData.map((dt) => ({ drugId: id, ...dt })));
      }
    }

    const updatedDrug = await tx.query.drugs.findFirst({
      where: { id },
      with: { drugTreatment: true },
    });

    return updatedDrug!;
  });
}

export async function deleteDrug(id: string): Promise<void> {
  await appDrizzle.delete(drugs).where(eq(drugs.id, id));
}

export async function drugInUse(id: string): Promise<boolean> {
  const [result] = await appDrizzle.select({ count: count() }).from(treatments).where(eq(treatments.drugId, id));
  return result.count > 0;
}
