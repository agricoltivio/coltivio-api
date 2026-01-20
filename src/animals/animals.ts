import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { animals, farmIdColumnValue } from "../db/schema";
import { EarTag } from "../ear-tags/ear-tags";

export type AnimalCreateInput = Omit<
  typeof animals.$inferInsert,
  "id" | "farmId"
>;
export type AnimalUpdateInput = Partial<AnimalCreateInput>;
export type Animal = typeof animals.$inferSelect & {
  earTag: EarTag | null;
};
export type AnimalWithEearTagAndParents = Animal & {
  mother: Animal | null;
  father: Animal | null;
};

export function animalsApi(rlsDb: RlsDb) {
  return {
    async createAnimal(
      animalInput: AnimalCreateInput,
    ): Promise<AnimalWithEearTagAndParents> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(animals)
          .values({ ...farmIdColumnValue, ...animalInput })
          .returning();
        return result;
      });
      const animal = await this.getAnimalById(result.id);
      return animal!;
    },

    async getAnimalById(
      id: string,
    ): Promise<AnimalWithEearTagAndParents | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animals.findFirst({
          where: { id },
          with: {
            earTag: true,
            mother: {
              with: {
                earTag: true,
              },
            },
            father: {
              with: {
                earTag: true,
              },
            },
          },
        });
      });
    },

    async getAnimalsForFarm(farmId: string): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: { farmId },
          with: {
            earTag: true,
          },
        });
      });
    },

    // Returns only living animals (dateOfDeath is null)
    async getLivingAnimalsForFarm(farmId: string): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: { farmId, dateOfDeath: { isNull: true } },
          with: {
            earTag: true,
          },
        });
      });
    },

    async updateAnimal(
      id: string,
      data: AnimalUpdateInput,
    ): Promise<AnimalWithEearTagAndParents> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .update(animals)
          .set(data)
          .where(eq(animals.id, id))
          .returning({ id: animals.id });
        return result;
      });
      const animal = await this.getAnimalById(result.id);
      return animal!;
    },

    async deleteAnimal(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(animals).where(eq(animals.id, id));
      });
    },

    // Returns all children of an animal (where this animal is either mother or father)
    async getChildrenOfAnimal(animalId: string): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: {
            OR: [
              {
                motherId: animalId,
              },
              {
                fatherId: animalId,
              },
            ],
          },
          with: {
            earTag: true,
          },
        });
      });
    },
  };
}
