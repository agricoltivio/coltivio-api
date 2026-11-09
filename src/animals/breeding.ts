import { and, eq } from "drizzle-orm";
import { addUtcDays } from "../date-utils";
import { RlsDb } from "../db/db";
import { animalHeats, animalTypeSchema, farmGestationSettings, farmIdColumnValue } from "../db/schema";
import type { AnimalType } from "./animals";
import { todayUtcDay } from "./animals";
import { DEFAULT_GESTATION_DAYS } from "./gestation-defaults";

export type AnimalHeat = typeof animalHeats.$inferSelect;

export type AnimalHeatCreateInput = {
  date: Date;
  mated?: boolean;
  sireId?: string | null;
  sireName?: string | null;
  notes?: string | null;
};

export type AnimalHeatUpdateInput = Partial<AnimalHeatCreateInput>;

export type GestationSetting = { animalType: AnimalType; gestationDays: number; isDefault: boolean };

export type BreedingCalendarEntry = AnimalHeat & {
  expectedBirthDate: Date | null;
  animal: { id: string; name: string; type: AnimalType; earTagNumber: string | null };
  sire: { id: string; name: string } | null;
};

export function breedingApi(db: RlsDb) {
  async function getGestationSettings(farmId: string): Promise<GestationSetting[]> {
    const configured = await db.rls(async (tx) => {
      return tx.query.farmGestationSettings.findMany({ where: { farmId } });
    });
    const configuredByType = new Map(configured.map((setting) => [setting.animalType, setting.gestationDays]));
    return animalTypeSchema.options.map((animalType) => {
      const configuredDays = configuredByType.get(animalType);
      return {
        animalType,
        gestationDays: configuredDays ?? DEFAULT_GESTATION_DAYS[animalType],
        isDefault: configuredDays === undefined,
      };
    });
  }

  return {
    getGestationSettings,

    async updateGestationSettings(
      farmId: string,
      settings: { animalType: AnimalType; gestationDays: number | null }[]
    ): Promise<GestationSetting[]> {
      await db.rls(async (tx) => {
        for (const setting of settings) {
          // null resets the type back to its default
          if (setting.gestationDays === null) {
            await tx
              .delete(farmGestationSettings)
              .where(
                and(eq(farmGestationSettings.farmId, farmId), eq(farmGestationSettings.animalType, setting.animalType))
              );
            continue;
          }
          await tx
            .insert(farmGestationSettings)
            .values({ ...farmIdColumnValue, animalType: setting.animalType, gestationDays: setting.gestationDays })
            .onConflictDoUpdate({
              target: [farmGestationSettings.farmId, farmGestationSettings.animalType],
              set: { gestationDays: setting.gestationDays },
            });
        }
      });
      return getGestationSettings(farmId);
    },

    async listHeats(animalId: string): Promise<AnimalHeat[]> {
      return db.rls(async (tx) => {
        return tx.query.animalHeats.findMany({
          where: { animalId },
          orderBy: { date: "desc", createdAt: "desc" },
        });
      });
    },

    async createHeat(animalId: string, createdBy: string, input: AnimalHeatCreateInput): Promise<AnimalHeat> {
      return db.rls(async (tx) => {
        const [heat] = await tx
          .insert(animalHeats)
          .values({ ...farmIdColumnValue, animalId, createdBy, ...input })
          .returning();
        return heat;
      });
    },

    async updateHeat(heatId: string, input: AnimalHeatUpdateInput): Promise<AnimalHeat | undefined> {
      return db.rls(async (tx) => {
        // Drizzle rejects an empty update set
        if (Object.keys(input).length === 0) return tx.query.animalHeats.findFirst({ where: { id: heatId } });
        const [heat] = await tx.update(animalHeats).set(input).where(eq(animalHeats.id, heatId)).returning();
        return heat;
      });
    },

    async deleteHeat(heatId: string): Promise<void> {
      await db.rls(async (tx) => {
        await tx.delete(animalHeats).where(eq(animalHeats.id, heatId));
      });
    },

    // Heats of living animals that either happened in the range or (when mated) are expected to give birth in it
    async getCalendar(farmId: string, from?: Date, to?: Date): Promise<BreedingCalendarEntry[]> {
      const rangeFrom = from ?? addUtcDays(todayUtcDay(), -60);
      const rangeTo = to ?? addUtcDays(todayUtcDay(), 365);
      const gestationSettings = await getGestationSettings(farmId);
      const gestationDaysByType = new Map(
        gestationSettings.map((setting) => [setting.animalType, setting.gestationDays])
      );
      // Heats up to the longest gestation before the range can still have their birth in it
      const longestGestationDays = Math.max(...gestationSettings.map((setting) => setting.gestationDays));

      const heats = await db.rls(async (tx) => {
        return tx.query.animalHeats.findMany({
          where: {
            farmId,
            date: { gte: addUtcDays(rangeFrom, -longestGestationDays), lte: rangeTo },
            animal: { dateOfDeath: { isNull: true } },
          },
          with: {
            animal: { with: { earTag: true } },
            sire: true,
          },
          orderBy: { date: "asc" },
        });
      });

      const entries: BreedingCalendarEntry[] = [];
      for (const heat of heats) {
        const gestationDays = gestationDaysByType.get(heat.animal.type) ?? DEFAULT_GESTATION_DAYS[heat.animal.type];
        const expectedBirthDate = heat.mated ? addUtcDays(heat.date, gestationDays) : null;
        const heatInRange = heat.date >= rangeFrom && heat.date <= rangeTo;
        const birthInRange =
          expectedBirthDate !== null && expectedBirthDate >= rangeFrom && expectedBirthDate <= rangeTo;
        if (!heatInRange && !birthInRange) continue;
        const { animal, sire, ...heatFields } = heat;
        entries.push({
          ...heatFields,
          expectedBirthDate,
          animal: { id: animal.id, name: animal.name, type: animal.type, earTagNumber: animal.earTag?.number ?? null },
          sire: sire ? { id: sire.id, name: sire.name } : null,
        });
      }
      return entries;
    },
  };
}
