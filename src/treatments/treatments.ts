import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import type { Animal } from "../animals/animals";
import { RlsDb } from "../db/db";
import { farmIdColumnValue, treatments } from "../db/schema";
import type { DrugWithTreatment } from "../drugs/drugs";

export type TreatmentCreateInput = Omit<
  typeof treatments.$inferInsert,
  "id" | "farmId" | "createdAt" | "createdBy"
>;

export type TreatmentUpdateInput = Partial<
  Omit<TreatmentCreateInput, "animalId" | "drugId">
>;

export type Treatment = typeof treatments.$inferSelect;

export type TreatmentWithRelations = Treatment & {
  animal: Animal;
  drug: DrugWithTreatment | null;
};

export function treatmentsApi(rlsDb: RlsDb) {
  return {
    async createTreatment(
      treatmentInput: TreatmentCreateInput,
      userId: string,
    ): Promise<Treatment> {
      return rlsDb.rls(async (tx) => {
        let milkUsableDate = treatmentInput.milkUsableDate;
        let meatUsableDate = treatmentInput.meatUsableDate;

        // If dates not provided, auto-calculate
        if (treatmentInput.drugId && (!milkUsableDate || !meatUsableDate)) {
          // Fetch animal to get type
          const animal = await tx.query.animals.findFirst({
            where: { id: treatmentInput.animalId },
          });

          if (!animal) {
            throw new Error("Animal not found");
          }

          const drugTreatmentData = await tx.query.drugTreatment.findFirst({
            where: {
              drugId: treatmentInput.drugId,
              animalType: animal.type,
            },
          });
          if (!drugTreatmentData) {
            throw new Error(
              `No treatment data found for drug and animal type ${animal.type}`,
            );
          }

          // Calculate dates if not provided
          if (!milkUsableDate) {
            milkUsableDate = addDays(
              treatmentInput.date,
              drugTreatmentData.milkWaitingDays,
            );
          }
          if (!meatUsableDate) {
            meatUsableDate = addDays(
              treatmentInput.date,
              drugTreatmentData.meatWaitingDays,
            );
          }
        }

        // Insert treatment
        const [treatment] = await tx
          .insert(treatments)
          .values({
            ...farmIdColumnValue,
            ...treatmentInput,
            milkUsableDate,
            meatUsableDate,
            createdBy: userId,
          })
          .returning();

        return treatment;
      });
    },

    async getTreatmentById(
      id: string,
    ): Promise<TreatmentWithRelations | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.treatments.findFirst({
          where: { id },
          with: {
            animal: {
              with: {
                earTag: true,
              },
            },
            drug: {
              with: {
                drugTreatment: true,
              },
            },
          },
        });
      });
    },

    async getTreatmentsForFarm(
      farmId: string,
    ): Promise<TreatmentWithRelations[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.treatments.findMany({
          where: { farmId },
          with: {
            animal: {
              with: {
                earTag: true,
              },
            },
            drug: {
              with: {
                drugTreatment: true,
              },
            },
          },
          orderBy: { date: "desc" },
        });
      });
    },

    async getTreatmentsForAnimal(
      animalId: string,
    ): Promise<TreatmentWithRelations[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.treatments.findMany({
          where: { animalId },
          with: {
            drug: {
              with: {
                drugTreatment: true,
              },
            },
            animal: {
              with: {
                earTag: true,
              },
            },
          },
          orderBy: { date: "desc" },
        });
      });
    },

    async updateTreatment(
      id: string,
      data: TreatmentUpdateInput,
    ): Promise<Treatment> {
      return rlsDb.rls(async (tx) => {
        // Just use user input, no auto-calculation on update
        const [treatment] = await tx
          .update(treatments)
          .set(data)
          .where(eq(treatments.id, id))
          .returning();

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
