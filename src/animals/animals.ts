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
export type AnimalWithRelations = Animal & {
  mother: Animal | null;
  father: Animal | null;
  childrenAsMother: Animal[];
  childrenAsFather: Animal[];
};

export function animalsApi(rlsDb: RlsDb) {
  return {
    async createAnimal(animalInput: AnimalCreateInput): Promise<Animal> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(animals)
          .values({ ...farmIdColumnValue, ...animalInput })
          .returning();
        return result;
      });
      const animal = await rlsDb.rls(async (tx) => {
        return tx.query.animals.findFirst({
          where: { id: result.id },
          with: {
            earTag: true,
          },
        });
      });
      return animal!;
    },

    async getAnimalById(id: string): Promise<AnimalWithRelations | undefined> {
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
            childrenAsFather: {
              with: {
                earTag: true,
              },
            },
            childrenAsMother: {
              with: {
                earTag: true,
              },
            },
          },
        });
      });
    },

    async getAnimalsForFarm(
      farmId: string,
      onlyLiving: boolean,
    ): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: {
            farmId,
            dateOfDeath: onlyLiving ? { isNull: true } : undefined,
          },
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

    async updateAnimal(id: string, data: AnimalUpdateInput): Promise<Animal> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .update(animals)
          .set(data)
          .where(eq(animals.id, id))
          .returning({ id: animals.id });
        return result;
      });
      const animal = await rlsDb.rls(async (tx) => {
        return tx.query.animals.findFirst({
          where: { id: result.id },
          with: {
            earTag: true,
          },
        });
      });
      return animal!;
    },

    async deleteAnimal(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(animals).where(eq(animals.id, id));
      });
    },

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
