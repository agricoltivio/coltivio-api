import { and, eq, isNull, or } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { animals, farmIdColumnValue } from "../db/schema";

export type AnimalCreateInput = Omit<
  typeof animals.$inferInsert,
  "id" | "farmId"
>;
export type AnimalUpdateInput = Partial<AnimalCreateInput>;
export type Animal = typeof animals.$inferSelect;

export function animalsApi(rlsDb: RlsDb) {
  return {
    async createAnimal(animalInput: AnimalCreateInput): Promise<Animal> {
      return rlsDb.rls(async (tx) => {
        const [animal] = await tx
          .insert(animals)
          .values({ ...farmIdColumnValue, ...animalInput })
          .returning();
        return animal;
      });
    },

    async getAnimalById(id: string): Promise<Animal | undefined> {
      return rlsDb.rls(async (tx) => {
        const [animal] = await tx
          .select()
          .from(animals)
          .where(eq(animals.id, id));
        return animal;
      });
    },

    async getAnimalsForFarm(farmId: string): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx.select().from(animals).where(eq(animals.farmId, farmId));
      });
    },

    // Returns only living animals (dateOfDeath is null)
    async getLivingAnimalsForFarm(farmId: string): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(animals)
          .where(and(eq(animals.farmId, farmId), isNull(animals.dateOfDeath)));
      });
    },

    async updateAnimal(id: string, data: AnimalUpdateInput): Promise<Animal> {
      return rlsDb.rls(async (tx) => {
        const [animal] = await tx
          .update(animals)
          .set(data)
          .where(eq(animals.id, id))
          .returning();
        return animal;
      });
    },

    async deleteAnimal(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(animals).where(eq(animals.id, id));
      });
    },

    // Returns all children of an animal (where this animal is either mother or father)
    async getChildrenOfAnimal(animalId: string): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(animals)
          .where(
            or(
              eq(animals.motherId, animalId),
              eq(animals.fatherId, animalId),
            ),
          );
      });
    },
  };
}
