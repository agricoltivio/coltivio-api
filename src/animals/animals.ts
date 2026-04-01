import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import createHttpError from "http-errors";
import { TFunction } from "i18next";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { EarTag } from "../ear-tags/ear-tags";
import { Treatment } from "../treatments/treatments";
import { buildOutdoorJournal, expandOutdoorSchedule, OutdoorJournalResult } from "./outdoor-journal";

// SQL fragment to compute if animal has no active waiting times from treatments
const _milkAndMeatUsableExtra = sql<boolean>`NOT EXISTS (
  SELECT 1 FROM ${tables.animalTreatments}
  JOIN ${tables.treatments} ON ${tables.treatments.id} = ${tables.animalTreatments.treatmentId}
  WHERE ${tables.animalTreatments.animalId} = ${tables.animals.id}
  AND (${tables.treatments.milkUsableDate} > NOW() OR ${tables.treatments.meatUsableDate} > NOW())
)`.as("milk_and_meat_usable");

// Sex value mapping (all locales combined — values are lowercased before lookup)
const SEX_MAP: Record<string, "male" | "female"> = {
  // German
  weiblich: "female",
  w: "female",
  geiss: "female",
  geiß: "female",
  männlich: "male",
  m: "male",
  bock: "male",
  // Italian
  femmina: "female",
  maschio: "male",
  // French
  femelle: "female",
  mâle: "male",
};

type AnimalUsage = (typeof tables.animalUsage.enumValues)[number];

// Usage value mapping (all locales combined — values are lowercased before lookup)
const USAGE_MAP: Record<string, AnimalUsage> = {
  // German
  milch: "milk",
  milk: "milk",
  andere: "other",
  other: "other",
  "nicht definiert": "other",
  // Italian
  latte: "milk",
  "non definito": "other",
  altro: "other",
  // French
  lait: "milk",
  "non défini": "other",
  autre: "other",
};

// Header name to logical field mapping, keyed by locale
const HEADER_MAP: Record<string, Record<string, string>> = {
  de: {
    ohrmarkennummer: "earTag",
    tiername: "name",
    geschlecht: "sex",
    geburtsdatum: "dateOfBirth",
    nutzungsart: "usage",
    todesdatum: "dateOfDeath",
    "ohrmarkennummer (mutter)": "motherEarTag",
    "ohrmarkennummer (vater)": "fatherEarTag",
  },
  it: {
    "numero di marca auricolare": "earTag",
    nome: "name",
    sesso: "sex",
    "data di nascita": "dateOfBirth",
    "tipo d'utilizzo": "usage",
    "data del decesso": "dateOfDeath",
    "numero di marca auricolare (madre)": "motherEarTag",
    "numero di marca auricolare (padre)": "fatherEarTag",
  },
  fr: {
    "numéro de marque auriculaire": "earTag",
    nom: "name",
    sexe: "sex",
    "date de naissance": "dateOfBirth",
    "type d'utilisation": "usage",
    "date de mort": "dateOfDeath",
    "numéro de marque auriculaire (mère)": "motherEarTag",
    "numéro de marque auriculaire (père)": "fatherEarTag",
  },
};

// Parses a date string — supports ISO (YYYY-MM-DD) and DD.MM.YYYY (used in Italian/Swiss TVD exports)
function parseDateString(value: string): Date | null {
  const dotFormat = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotFormat) {
    const [, day, month, year] = dotFormat;
    const d = new Date(`${year}-${month}-${day}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export type SkippedRow = {
  row: number;
  earTagNumber: string | null;
  name: string | null;
  reason: string;
};

export type ImportResult = {
  skipped: SkippedRow[];
  summary: {
    totalRows: number;
    imported: number;
    skipped: number;
  };
};

export type AnimalType = (typeof tables.animalType.enumValues)[number];
export type AnimalCategory = (typeof tables.animalCategory.enumValues)[number];
export type AnimalSex = (typeof tables.animalSex.enumValues)[number];
export type AnimalDeathReason = (typeof tables.deathReason.enumValues)[number];

export type Herd = typeof tables.herds.$inferSelect;
export type HerdMembership = typeof tables.herdMemberships.$inferSelect;
export type OutdoorSchedule = typeof tables.outdoorSchedules.$inferSelect;
export type OutdoorScheduleRecurrence = typeof tables.outdoorScheduleRecurrences.$inferSelect;

export type OutdoorScheduleWithRecurrence = OutdoorSchedule & {
  recurrence: OutdoorScheduleRecurrence | null;
};
export type OutdoorScheduleType = (typeof tables.outdoorScheduleType.enumValues)[number];

export type OutdoorScheduleCreateInput = {
  startDate: Date;
  endDate?: Date | null;
  type: OutdoorScheduleType;
  notes?: string | null;
  recurrence?: {
    frequency: (typeof tables.frequency.enumValues)[number];
    interval: number;
    byWeekday?: (typeof tables.weekday.enumValues)[number][] | null;
    byMonthDay?: number | null;
    until?: string | null;
    count?: number | null;
  } | null;
};

export type OutdoorScheduleUpdateInput = Partial<OutdoorScheduleCreateInput>;

// Build a minimal OutdoorScheduleWithRecurrence from a create input so it can
// be passed to expandOutdoorSchedule without needing real DB ids.
function inputToSchedule(input: OutdoorScheduleCreateInput): OutdoorScheduleWithRecurrence {
  return {
    id: "",
    farmId: "",
    herdId: "",
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    type: input.type,
    notes: input.notes ?? null,
    recurrence: input.recurrence
      ? {
          id: "",
          farmId: "",
          outdoorScheduleId: "",
          frequency: input.recurrence.frequency,
          interval: input.recurrence.interval,
          byWeekday: input.recurrence.byWeekday ?? null,
          byMonthDay: input.recurrence.byMonthDay ?? null,
          until: input.recurrence.until ?? null,
          count: input.recurrence.count ?? null,
        }
      : null,
  };
}

// Checks if any two schedules in the list produce overlapping concrete occurrences.
// Uses a 25-year window starting from the earliest schedule start date.
export function hasScheduleOverlap(schedules: OutdoorScheduleWithRecurrence[]): boolean {
  if (schedules.length < 2) return false;
  const windowFrom = schedules.reduce((min, s) => (s.startDate < min ? s.startDate : min), schedules[0].startDate);
  const windowTo = new Date(windowFrom.getFullYear() + 25, windowFrom.getMonth(), windowFrom.getDate());
  const expanded = schedules.map((s) => expandOutdoorSchedule(s, windowFrom, windowTo));
  for (let i = 0; i < expanded.length; i++) {
    for (let j = i + 1; j < expanded.length; j++) {
      for (const a of expanded[i]) {
        for (const b of expanded[j]) {
          if (a.startDate <= b.endDate && b.startDate <= a.endDate) return true;
        }
      }
    }
  }
  return false;
}

export type AnimalCreateInput = Omit<typeof tables.animals.$inferInsert, "id" | "farmId">;
export type AnimalUpdateInput = Partial<AnimalCreateInput>;
export type BatchUpdateAnimalInput = {
  type?: AnimalType;
  usage?: AnimalUsage;
  registered?: boolean;
  dateOfDeath?: Date;
  deathReason?: AnimalDeathReason;
  motherId?: string | null;
  fatherId?: string | null;
};
export type CustomOutdoorJournalCategory = typeof tables.customOutdoorJournalCategories.$inferSelect;
export type Animal = typeof tables.animals.$inferSelect & {
  earTag: EarTag | null;
};

export type ParsedImportRow = {
  rowNumber: number;
  earTagNumber: string | null;
  earTagId: string | null; // non-null if an existing unassigned ear tag was found in DB
  earTagAssigned: boolean; // true if the ear tag is already assigned to a different animal
  assignedToAnimalId: string | null; // the animal that currently holds this ear tag (if earTagAssigned)
  name: string | null;
  sex: "male" | "female" | null;
  dateOfBirth: Date | null;
  usage: AnimalUsage | null;
  dateOfDeath: Date | null;
  deathReason: AnimalDeathReason | null; // preset to "died" when dateOfDeath is present
  motherEarTagNumber: string | null;
  fatherEarTagNumber: string | null;
  parseErrors: string[]; // empty means the row is importable as-is
};

export type CommitImportRow = {
  earTagNumber?: string | null;
  earTagId?: string | null;
  name: string;
  sex: "male" | "female";
  dateOfBirth: Date;
  usage: AnimalUsage;
  dateOfDeath?: Date | null;
  deathReason?: AnimalDeathReason | null;
  motherEarTagNumber?: string | null;
  fatherEarTagNumber?: string | null;
  mergeAnimalId?: string | null; // if set, update existing animal instead of creating a new one
};

export type CommitImportResult = {
  created: number;
  merged: number;
  skipped: Array<{ index: number; reason: string }>; // 0-based index into the input rows array
};
export type FamilyTreeNode = {
  id: string;
  name: string;
  earTagNumber: string | null;
  dateOfBirth: Date;
  dateOfDeath: Date | null;
  sex: "male" | "female";
};

export type FamilyTreeEdge = {
  parentId: string;
  childId: string;
  relation: "mother" | "father";
};

export type FamilyTreeResult = {
  nodes: FamilyTreeNode[];
  edges: FamilyTreeEdge[];
};

export type AnimalWithRelations = Animal & {
  mother: Animal | null;
  father: Animal | null;
  childrenAsMother: Animal[];
  childrenAsFather: Animal[];
  treatments: Treatment[];
  herd: Herd | null;
  customOutdoorJournalCategories: CustomOutdoorJournalCategory[];
};

export function animalsApi(rlsDb: RlsDb, t: TFunction) {
  return {
    async createAnimal(animalInput: AnimalCreateInput): Promise<Animal> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(tables.animals)
          .values({
            ...tables.farmIdColumnValue,
            ...animalInput,
          })
          .returning();

        // Create herd membership if animal is assigned to a herd
        if (animalInput.herdId) {
          await tx.insert(tables.herdMemberships).values({
            ...tables.farmIdColumnValue,
            animalId: result.id,
            herdId: animalInput.herdId,
            fromDate: new Date(),
          });
        }

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
        const result = await tx.query.animals.findFirst({
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
            animalTreatments: {
              with: {
                treatment: true,
              },
            },
            herd: true,
            customOutdoorJournalCategories: true,
          },
        });
        if (!result) return undefined;
        return {
          ...result,
          treatments: result.animalTreatments.map((at) => at.treatment),
        };
      });
    },

    async getAnimalsForFarm(
      farmId: string,
      onlyLiving: boolean,
      animalTypes?: AnimalType[]
    ): Promise<Array<Animal & { milkAndMeatUsable: boolean }>> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: {
            farmId,
            type: { in: animalTypes },
            dateOfDeath: onlyLiving ? { isNull: true } : undefined,
          },
          with: {
            earTag: true,
          },
          extras: {
            milkAndMeatUsable: (table) =>
              sql<boolean>`NOT EXISTS (
                  SELECT 1 FROM ${tables.animalTreatments}
                  JOIN ${tables.treatments} ON ${tables.treatments.id} = ${tables.animalTreatments.treatmentId}
                  WHERE ${tables.animalTreatments.animalId} = ${table.id}
                  AND (${tables.treatments.milkUsableDate} > NOW() OR ${tables.treatments.meatUsableDate} > NOW())
              )`.as("milk_and_meat_usable"),
          },
        });
      });
    },

    async getFamilyTree(farmId: string, type: AnimalType): Promise<FamilyTreeResult> {
      const allAnimals = await rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: { farmId, type },
          with: { earTag: true },
        });
      });

      const animalIds = new Set(allAnimals.map((a) => a.id));

      const nodes: FamilyTreeNode[] = allAnimals.map((a) => ({
        id: a.id,
        name: a.name,
        earTagNumber: a.earTag?.number ?? null,
        dateOfBirth: a.dateOfBirth,
        dateOfDeath: a.dateOfDeath ?? null,
        sex: a.sex,
      }));

      const edges: FamilyTreeEdge[] = [];
      for (const a of allAnimals) {
        if (a.motherId && animalIds.has(a.motherId)) {
          edges.push({ parentId: a.motherId, childId: a.id, relation: "mother" });
        }
        if (a.fatherId && animalIds.has(a.fatherId)) {
          edges.push({ parentId: a.fatherId, childId: a.id, relation: "father" });
        }
      }

      return { nodes, edges };
    },

    async updateAnimals(data: Array<AnimalUpdateInput & { id: string }>): Promise<Animal[]> {
      await rlsDb.rls(async (tx) => {
        const today = new Date();
        await Promise.all(
          data.map(async ({ id, ...animal }) => {
            await tx.update(tables.animals).set(animal).where(eq(tables.animals.id, id));

            // Manage herd membership when herdId changes
            if (animal.herdId !== undefined) {
              await tx
                .update(tables.herdMemberships)
                .set({ toDate: today })
                .where(and(eq(tables.herdMemberships.animalId, id), isNull(tables.herdMemberships.toDate)));
              if (animal.herdId) {
                await tx.insert(tables.herdMemberships).values({
                  ...tables.farmIdColumnValue,
                  animalId: id,
                  herdId: animal.herdId,
                  fromDate: today,
                });
              }
            }
          })
        );
      });
      const result = await rlsDb.rls(async (tx) => {
        return tx.query.animals.findMany({
          where: { id: { in: data.map(({ id }) => id) } },
          with: {
            earTag: true,
          },
        });
      });
      return result!;
    },

    async updateAnimal(id: string, data: AnimalUpdateInput): Promise<Animal> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .update(tables.animals)
          .set(data)
          .where(eq(tables.animals.id, id))
          .returning({ id: tables.animals.id, herdId: tables.animals.herdId });
        return result;
      });

      // Manage herd membership when herdId changes
      if (data.herdId !== undefined) {
        await rlsDb.rls(async (tx) => {
          const today = new Date();
          // Close any active membership for this animal
          await tx
            .update(tables.herdMemberships)
            .set({ toDate: today })
            .where(and(eq(tables.herdMemberships.animalId, id), isNull(tables.herdMemberships.toDate)));
          // Create new membership if assigned to a herd
          if (data.herdId) {
            await tx.insert(tables.herdMemberships).values({
              ...tables.farmIdColumnValue,
              animalId: id,
              herdId: data.herdId,
              fromDate: today,
            });
          }
        });
      }

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

    async batchUpdateAnimals(animalIds: string[], data: BatchUpdateAnimalInput): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        await tx.update(tables.animals).set(data).where(inArray(tables.animals.id, animalIds));
        return tx.query.animals.findMany({
          where: { id: { in: animalIds } },
          with: {
            earTag: true,
          },
        });
      });
    },

    async deleteAnimals(animalIds: string[]) {
      return rlsDb.rls(async (tx) => {
        await tx.delete(tables.animals).where(inArray(tables.animals.id, animalIds));
      });
    },

    async deleteAnimal(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(tables.animals).where(eq(tables.animals.id, id));
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

    // --- Herds CRUD ---

    async getHerdsForFarm(farmId: string) {
      return rlsDb.rls(async (tx) => {
        return tx.query.herds.findMany({
          where: { farmId },
          with: {
            animals: { with: { earTag: true } },
            outdoorSchedules: { with: { recurrence: true } },
          },
        });
      });
    },

    async getHerdById(id: string) {
      return rlsDb.rls(async (tx) => {
        return tx.query.herds.findFirst({
          where: { id },
          with: {
            animals: { with: { earTag: true } },
            outdoorSchedules: { with: { recurrence: true } },
          },
        });
      });
    },

    async createHerd(input: { name: string }, animalIds: string[], outdoorSchedules?: OutdoorScheduleCreateInput[]) {
      // Validate overlap among schedules before entering the transaction
      if (outdoorSchedules?.length) {
        if (hasScheduleOverlap(outdoorSchedules.map(inputToSchedule))) {
          throw createHttpError(409, "Schedule overlaps with another schedule");
        }
      }

      return rlsDb.rls(async (tx) => {
        const [herd] = await tx
          .insert(tables.herds)
          .values({ ...tables.farmIdColumnValue, ...input })
          .returning();

        if (animalIds.length > 0) {
          // Update denormalized herdId on animals
          await tx.update(tables.animals).set({ herdId: herd.id }).where(inArray(tables.animals.id, animalIds));

          // Close any active memberships and create new ones.
          // If schedules are provided and the earliest startDate is in the past, backdate membership
          // to that date so the outdoor journal reflects the full schedule history.
          const today = new Date();
          const earliestScheduleStart =
            outdoorSchedules && outdoorSchedules.length > 0
              ? outdoorSchedules.reduce(
                  (earliest, s) => (s.startDate < earliest ? s.startDate : earliest),
                  outdoorSchedules[0].startDate
                )
              : null;
          const membershipFromDate =
            earliestScheduleStart && earliestScheduleStart < today ? earliestScheduleStart : today;

          for (const animalId of animalIds) {
            await tx
              .update(tables.herdMemberships)
              .set({ toDate: membershipFromDate })
              .where(and(eq(tables.herdMemberships.animalId, animalId), isNull(tables.herdMemberships.toDate)));
            await tx.insert(tables.herdMemberships).values({
              ...tables.farmIdColumnValue,
              animalId,
              herdId: herd.id,
              fromDate: membershipFromDate,
            });
          }
        }

        // Create outdoor schedules if provided (overlap already validated above)
        if (outdoorSchedules?.length) {
          for (const { recurrence, ...scheduleInput } of outdoorSchedules) {
            const [schedule] = await tx
              .insert(tables.outdoorSchedules)
              .values({
                ...tables.farmIdColumnValue,
                herdId: herd.id,
                ...scheduleInput,
              })
              .returning();

            if (recurrence) {
              await tx.insert(tables.outdoorScheduleRecurrences).values({
                ...tables.farmIdColumnValue,
                outdoorScheduleId: schedule.id,
                ...recurrence,
              });
            }
          }
        }

        return herd;
      });
    },

    async updateHerd(
      id: string,
      input: { name?: string },
      animalIds?: string[],
      outdoorSchedules?: OutdoorScheduleCreateInput[]
    ) {
      // Validate overlap among new schedules before entering the transaction
      if (outdoorSchedules?.length) {
        if (hasScheduleOverlap(outdoorSchedules.map(inputToSchedule))) {
          throw createHttpError(409, "Schedule overlaps with another schedule");
        }
      }

      return rlsDb.rls(async (tx) => {
        // Only run the update if there are fields to set (avoids Drizzle "No values to set" error)
        const [herd] =
          Object.keys(input).length > 0
            ? await tx.update(tables.herds).set(input).where(eq(tables.herds.id, id)).returning()
            : await tx.query.herds.findMany({ where: { id }, limit: 1 });

        // If animalIds provided, replace all assignments: clear existing, set new
        if (animalIds !== undefined) {
          const today = new Date();

          // Close all active memberships for this herd
          await tx
            .update(tables.herdMemberships)
            .set({ toDate: today })
            .where(and(eq(tables.herdMemberships.herdId, id), isNull(tables.herdMemberships.toDate)));

          // Update denormalized herdId on animals
          await tx.update(tables.animals).set({ herdId: null }).where(eq(tables.animals.herdId, id));

          if (animalIds.length > 0) {
            await tx.update(tables.animals).set({ herdId: id }).where(inArray(tables.animals.id, animalIds));

            // Close any other active membership for each animal, then create new
            for (const animalId of animalIds) {
              await tx
                .update(tables.herdMemberships)
                .set({ toDate: today })
                .where(and(eq(tables.herdMemberships.animalId, animalId), isNull(tables.herdMemberships.toDate)));
              await tx.insert(tables.herdMemberships).values({
                ...tables.farmIdColumnValue,
                animalId,
                herdId: id,
                fromDate: today,
              });
            }
          }
        }

        // If outdoorSchedules provided, delete all existing and replace with new ones
        if (outdoorSchedules !== undefined) {
          // Recurrences cascade-delete with their parent schedule
          await tx.delete(tables.outdoorSchedules).where(eq(tables.outdoorSchedules.herdId, id));

          // Create new schedules (overlap already validated above)
          for (const { recurrence, ...scheduleInput } of outdoorSchedules) {
            const [schedule] = await tx
              .insert(tables.outdoorSchedules)
              .values({
                ...tables.farmIdColumnValue,
                herdId: id,
                ...scheduleInput,
              })
              .returning();

            if (recurrence) {
              await tx.insert(tables.outdoorScheduleRecurrences).values({
                ...tables.farmIdColumnValue,
                outdoorScheduleId: schedule.id,
                ...recurrence,
              });
            }
          }
        }

        return herd;
      });
    },

    async deleteHerd(id: string) {
      return rlsDb.rls(async (tx) => {
        await tx.delete(tables.herds).where(eq(tables.herds.id, id));
      });
    },

    // --- Outdoor Schedules CRUD ---

    async getOutdoorSchedulesForHerd(herdId: string) {
      return rlsDb.rls(async (tx) => {
        return tx.query.outdoorSchedules.findMany({
          where: { herdId },
          with: { recurrence: true },
        });
      });
    },

    async getOutdoorScheduleById(id: string) {
      return rlsDb.rls(async (tx) => {
        return tx.query.outdoorSchedules.findFirst({
          where: { id },
          with: { recurrence: true },
        });
      });
    },

    async createOutdoorSchedule(
      herdId: string,
      input: OutdoorScheduleCreateInput
    ): Promise<OutdoorScheduleWithRecurrence> {
      const { recurrence, ...scheduleInput } = input;

      // Validate no overlap with existing schedules for this herd
      const existing = await this.getOutdoorSchedulesForHerd(herdId);
      if (hasScheduleOverlap([...existing, inputToSchedule(input)])) {
        throw createHttpError(409, "Schedule overlaps with existing schedule");
      }

      const result = await rlsDb.rls(async (tx) => {
        const [schedule] = await tx
          .insert(tables.outdoorSchedules)
          .values({
            ...tables.farmIdColumnValue,
            herdId,
            ...scheduleInput,
          })
          .returning();

        if (recurrence) {
          await tx.insert(tables.outdoorScheduleRecurrences).values({
            ...tables.farmIdColumnValue,
            outdoorScheduleId: schedule.id,
            ...recurrence,
          });
        }

        return schedule;
      });

      const created = await this.getOutdoorScheduleById(result.id);
      return created!;
    },

    async updateOutdoorSchedule(id: string, input: OutdoorScheduleUpdateInput): Promise<OutdoorScheduleWithRecurrence> {
      const { recurrence, ...scheduleData } = input;

      // Fetch current schedule to know its herdId
      const current = await this.getOutdoorScheduleById(id);
      if (!current) {
        throw createHttpError(404, "Outdoor schedule not found");
      }

      // Validate no overlap (exclude self)
      if (scheduleData.startDate !== undefined || scheduleData.endDate !== undefined || recurrence !== undefined) {
        const existing = await this.getOutdoorSchedulesForHerd(current.herdId);
        const updatedSchedule: OutdoorScheduleWithRecurrence = {
          ...current,
          startDate: scheduleData.startDate ?? current.startDate,
          endDate: scheduleData.endDate !== undefined ? scheduleData.endDate : current.endDate,
          recurrence:
            recurrence !== undefined
              ? recurrence
                ? {
                    ...current.recurrence,
                    id: current.recurrence?.id ?? "",
                    farmId: current.farmId,
                    outdoorScheduleId: current.id,
                    ...recurrence,
                    until: recurrence.until ?? null,
                    byWeekday: recurrence.byWeekday ?? null,
                    byMonthDay: recurrence.byMonthDay ?? null,
                    count: recurrence.count ?? null,
                  }
                : null
              : current.recurrence,
        };
        if (hasScheduleOverlap([...existing.filter((s) => s.id !== id), updatedSchedule])) {
          throw createHttpError(409, "Schedule overlaps with existing schedule");
        }
      }

      await rlsDb.rls(async (tx) => {
        // Update schedule fields if any provided
        if (Object.keys(scheduleData).length > 0) {
          await tx.update(tables.outdoorSchedules).set(scheduleData).where(eq(tables.outdoorSchedules.id, id));
        }

        // Handle recurrence upsert/delete
        if (recurrence !== undefined) {
          const existingRecurrence = await tx.query.outdoorScheduleRecurrences.findFirst({
            where: { outdoorScheduleId: id },
          });

          if (recurrence === null) {
            if (existingRecurrence) {
              await tx
                .delete(tables.outdoorScheduleRecurrences)
                .where(eq(tables.outdoorScheduleRecurrences.outdoorScheduleId, id));
            }
          } else if (existingRecurrence) {
            await tx
              .update(tables.outdoorScheduleRecurrences)
              .set(recurrence)
              .where(eq(tables.outdoorScheduleRecurrences.outdoorScheduleId, id));
          } else {
            await tx.insert(tables.outdoorScheduleRecurrences).values({
              ...tables.farmIdColumnValue,
              outdoorScheduleId: id,
              ...recurrence,
            });
          }
        }
      });

      const updated = await this.getOutdoorScheduleById(id);
      return updated!;
    },

    async deleteOutdoorSchedule(id: string) {
      return rlsDb.rls(async (tx) => {
        await tx.delete(tables.outdoorSchedules).where(eq(tables.outdoorSchedules.id, id));
      });
    },

    // Replace all custom outdoor journal categories for an animal, with overlap validation
    async setCustomOutdoorJournalCategories(
      animalId: string,
      entries: {
        startDate: Date;
        endDate?: Date | null;
        category: AnimalCategory;
      }[]
    ): Promise<CustomOutdoorJournalCategory[]> {
      // Validate no overlaps among the entries
      const rangeSchedules = entries.map((e) =>
        inputToSchedule({ startDate: e.startDate, endDate: e.endDate, type: "pasture", recurrence: null })
      );
      if (hasScheduleOverlap(rangeSchedules)) {
        throw createHttpError(409, "Custom outdoor journal category date ranges overlap");
      }

      return rlsDb.rls(async (tx) => {
        // Delete existing entries for this animal
        await tx
          .delete(tables.customOutdoorJournalCategories)
          .where(eq(tables.customOutdoorJournalCategories.animalId, animalId));

        if (entries.length === 0) return [];

        return tx
          .insert(tables.customOutdoorJournalCategories)
          .values(
            entries.map((e) => ({
              ...tables.farmIdColumnValue,
              animalId,
              startDate: e.startDate,
              endDate: e.endDate ?? null,
              category: e.category,
            }))
          )
          .returning();
      });
    },

    async getHerdsWithMembershipsForFarm(farmId: string) {
      return rlsDb.rls(async (tx) => {
        return tx.query.herds.findMany({
          where: { farmId },
          with: {
            herdMemberships: {
              with: {
                animal: {
                  with: { earTag: true, customOutdoorJournalCategories: true },
                },
              },
            },
            outdoorSchedules: { with: { recurrence: true } },
          },
        });
      });
    },

    async getOutdoorJournal(farmId: string, fromDate: Date, toDate: Date): Promise<OutdoorJournalResult> {
      const herds = await this.getHerdsWithMembershipsForFarm(farmId);
      return buildOutdoorJournal(herds, fromDate, toDate);
    },

    // Import animals from an Excel file buffer. Uses header row to detect columns by name.
    async importFromExcel(
      fileBuffer: Buffer,
      type: AnimalType,
      skipHeaderRow: boolean,
      farmId: string,
      locale: string = "de"
    ): Promise<ImportResult> {
      // Load Excel workbook from buffer
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("Excel file has no worksheets");
      }

      // Build column index map from header row
      const headerMap = HEADER_MAP[locale] ?? HEADER_MAP["de"];
      const columnIndex: Record<string, number> = {};

      if (!skipHeaderRow) {
        throw createHttpError(400, "A header row is required for import.");
      }

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const headerText = cell.text?.trim().toLowerCase();
        if (headerText) {
          const field = headerMap[headerText];
          if (field) {
            columnIndex[field] = colNumber;
          }
        }
      });

      // Validate all required columns were detected — collect all missing before failing
      const requiredColumns = ["earTag", "name", "sex", "dateOfBirth"] as const;
      const missingColumns = requiredColumns.filter((col) => !columnIndex[col]);
      if (missingColumns.length > 0) {
        const knownHeaders = Object.keys(headerMap).join(", ");
        throw createHttpError(
          400,
          `Missing required columns: ${missingColumns.join(", ")}. Known header names: ${knownHeaders}`
        );
      }

      // Fetch all existing ear tags for this farm to check for duplicates (with animal assignment info)
      const existingEarTags = await rlsDb.rls(async (tx) => {
        return tx.query.earTags.findMany({
          where: { farmId },
          with: { animal: { with: { earTag: true } } },
        });
      });
      const earTagByNumber = new Map(existingEarTags.map((tag) => [tag.number.toLowerCase(), tag]));

      const skippedRows: SkippedRow[] = [];
      const validAnimals: (AnimalCreateInput & { earTagNumber?: string })[] = [];
      const earTagsToCreate = new Set<string>();

      // Process rows
      let rowIndex = 0;
      worksheet.eachRow((row, rowNumber) => {
        rowIndex++;
        if (skipHeaderRow && rowNumber === 1) return;

        const earTagNumber = row.getCell(columnIndex["earTag"]).text?.trim() || null;
        const name = row.getCell(columnIndex["name"]).text?.trim() || null;
        const sexValue = row.getCell(columnIndex["sex"]).text?.trim().toLowerCase() || null;
        const dobCell = row.getCell(columnIndex["dateOfBirth"]);
        const usageValue = columnIndex["usage"]
          ? row.getCell(columnIndex["usage"]).text?.trim().toLowerCase() || null
          : null;

        const resolvedName = name ?? earTagNumber;
        if (!resolvedName) {
          skippedRows.push({
            row: rowNumber,
            earTagNumber,
            name,
            reason: "Name is required",
          });
          return;
        }

        if (!sexValue) {
          skippedRows.push({
            row: rowNumber,
            earTagNumber,
            name,
            reason: "Sex is required",
          });
          return;
        }
        const sex = SEX_MAP[sexValue];
        if (!sex) {
          skippedRows.push({
            row: rowNumber,
            earTagNumber,
            name,
            reason: `Unknown sex value: ${sexValue}`,
          });
          return;
        }

        // Parse usage — default to "other" if column not present or value not recognized
        let usage: AnimalUsage = "other";
        if (usageValue) {
          const mapped = USAGE_MAP[usageValue];
          if (mapped) {
            usage = mapped;
          }
        }

        let dateOfBirth: Date;
        if (dobCell.value) {
          if (dobCell.value instanceof Date) {
            dateOfBirth = dobCell.value;
          } else if (typeof dobCell.value === "string") {
            const parsed = parseDateString(dobCell.value);
            if (!parsed) {
              skippedRows.push({
                row: rowNumber,
                earTagNumber,
                name,
                reason: "Invalid date format",
              });
              return;
            }
            dateOfBirth = parsed;
          } else if (typeof dobCell.value === "number") {
            // Excel date serial number
            dateOfBirth = new Date(Math.round((dobCell.value - 25569) * 86400 * 1000));
          } else {
            skippedRows.push({
              row: rowNumber,
              earTagNumber,
              name,
              reason: "Invalid date format",
            });
            return;
          }
        } else {
          skippedRows.push({
            row: rowNumber,
            earTagNumber,
            name,
            reason: "Date of birth is required",
          });
          return;
        }

        // Check ear tag status
        let earTagId: string | undefined;
        if (earTagNumber) {
          const existingTag = earTagByNumber.get(earTagNumber.toLowerCase());
          if (existingTag) {
            if (existingTag.animal) {
              skippedRows.push({
                row: rowNumber,
                earTagNumber,
                name,
                reason: "Ear tag already assigned",
              });
              return;
            }
            earTagId = existingTag.id;
          } else {
            earTagsToCreate.add(earTagNumber);
          }
        }

        validAnimals.push({
          name: resolvedName,
          type,
          sex,
          usage,
          dateOfBirth,
          earTagId,
          earTagNumber: earTagNumber || undefined,
          registered: true,
        });
      });

      // Batch create missing ear tags
      const earTagNumbersToCreate = Array.from(earTagsToCreate);
      let newEarTags: EarTag[] = [];
      if (earTagNumbersToCreate.length > 0) {
        newEarTags = await rlsDb.rls(async (tx) => {
          return tx
            .insert(tables.earTags)
            .values(
              earTagNumbersToCreate.map((number) => ({
                ...tables.farmIdColumnValue,
                number,
              }))
            )
            .returning();
        });
      }
      const newEarTagMap = new Map(newEarTags.map((tag) => [tag.number.toLowerCase(), tag.id]));

      // Assign ear tag IDs
      const animalsToCreate: AnimalCreateInput[] = validAnimals.map((animal) => {
        const { earTagNumber, ...animalData } = animal;
        if (earTagNumber && !animalData.earTagId) {
          animalData.earTagId = newEarTagMap.get(earTagNumber.toLowerCase());
        }
        return animalData;
      });

      // Batch create all valid animals
      let importedCount = 0;
      if (animalsToCreate.length > 0) {
        const result = await rlsDb.rls(async (tx) => {
          return tx
            .insert(tables.animals)
            .values(
              animalsToCreate.map((input) => ({
                ...tables.farmIdColumnValue,
                ...input,
              }))
            )
            .returning({ id: tables.animals.id });
        });
        importedCount = result.length;
      }
      const totalRows = skipHeaderRow ? rowIndex - 1 : rowIndex;

      return {
        skipped: skippedRows,
        summary: {
          totalRows,
          imported: importedCount,
          skipped: skippedRows.length,
        },
      };
    },

    // Parse an Excel file and return all rows (valid + invalid) without writing to the DB.
    // The frontend uses this to show a preview, let the user edit/remove rows, and optionally
    // assign a mergeAnimalId before calling commitImport.
    async parseImportPreview(
      fileBuffer: Buffer,
      skipHeaderRow: boolean,
      farmId: string,
      locale: string = "de"
    ): Promise<ParsedImportRow[]> {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("Excel file has no worksheets");
      }

      const headerMap = HEADER_MAP[locale] ?? HEADER_MAP["de"];
      const columnIndex: Record<string, number> = {};

      if (!skipHeaderRow) {
        throw createHttpError(400, "A header row is required for import.");
      }

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const headerText = cell.text?.trim().toLowerCase();
        if (headerText) {
          const field = headerMap[headerText];
          if (field) {
            columnIndex[field] = colNumber;
          }
        }
      });

      const requiredColumns = ["earTag", "name", "sex", "dateOfBirth"] as const;
      const missingColumns = requiredColumns.filter((col) => !columnIndex[col]);
      if (missingColumns.length > 0) {
        const knownHeaders = Object.keys(headerMap).join(", ");
        throw createHttpError(
          400,
          `Missing required columns: ${missingColumns.join(", ")}. Known header names: ${knownHeaders}`
        );
      }

      // Fetch all existing ear tags for this farm to check assignment status
      const existingEarTags = await rlsDb.rls(async (tx) => {
        return tx.query.earTags.findMany({
          where: { farmId },
          with: { animal: true },
        });
      });
      const earTagByNumber = new Map(existingEarTags.map((tag) => [tag.number.toLowerCase(), tag]));

      const rows: ParsedImportRow[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (skipHeaderRow && rowNumber === 1) return;

        const earTagNumber = row.getCell(columnIndex["earTag"]).text?.trim() || null;
        const name = row.getCell(columnIndex["name"]).text?.trim() || null;
        const sexValue = row.getCell(columnIndex["sex"]).text?.trim().toLowerCase() || null;
        const dobCell = row.getCell(columnIndex["dateOfBirth"]);
        const usageValue = columnIndex["usage"]
          ? row.getCell(columnIndex["usage"]).text?.trim().toLowerCase() || null
          : null;
        const dodCell = columnIndex["dateOfDeath"] ? row.getCell(columnIndex["dateOfDeath"]) : null;
        const motherEarTagNumber = columnIndex["motherEarTag"]
          ? row.getCell(columnIndex["motherEarTag"]).text?.trim() || null
          : null;
        const fatherEarTagNumber = columnIndex["fatherEarTag"]
          ? row.getCell(columnIndex["fatherEarTag"]).text?.trim() || null
          : null;

        const parseErrors: string[] = [];

        const resolvedName = name ?? earTagNumber;
        if (!resolvedName) parseErrors.push(t("animal_import.error_name_required"));

        let sex: "male" | "female" | null = null;
        if (!sexValue) {
          parseErrors.push(t("animal_import.error_sex_required"));
        } else {
          sex = SEX_MAP[sexValue] ?? null;
          if (!sex) parseErrors.push(t("animal_import.error_sex_unknown", { value: sexValue }));
        }

        // Default usage to "other" when column is absent or value unrecognized
        const usage: AnimalUsage = usageValue ? (USAGE_MAP[usageValue] ?? "other") : "other";

        let dateOfBirth: Date | null = null;
        if (!dobCell.value) {
          parseErrors.push(t("animal_import.error_dob_required"));
        } else if (dobCell.value instanceof Date) {
          dateOfBirth = dobCell.value;
        } else if (typeof dobCell.value === "string") {
          const parsed = parseDateString(dobCell.value);
          if (!parsed) {
            parseErrors.push(t("animal_import.error_dob_invalid"));
          } else {
            dateOfBirth = parsed;
          }
        } else if (typeof dobCell.value === "number") {
          dateOfBirth = new Date(Math.round((dobCell.value - 25569) * 86400 * 1000));
        } else {
          parseErrors.push(t("animal_import.error_dob_invalid"));
        }

        // Parse optional date of death — same logic as dateOfBirth but no error if absent
        let dateOfDeath: Date | null = null;
        if (dodCell?.value) {
          if (dodCell.value instanceof Date) {
            dateOfDeath = dodCell.value;
          } else if (typeof dodCell.value === "string") {
            dateOfDeath = parseDateString(dodCell.value);
          } else if (typeof dodCell.value === "number") {
            dateOfDeath = new Date(Math.round((dodCell.value - 25569) * 86400 * 1000));
          }
        }

        // Look up ear tag in DB — populate earTagId / earTagAssigned / assignedToAnimalId for the frontend
        let earTagId: string | null = null;
        let earTagAssigned = false;
        let assignedToAnimalId: string | null = null;
        if (earTagNumber) {
          const existingTag = earTagByNumber.get(earTagNumber.toLowerCase());
          if (existingTag) {
            if (existingTag.animal) {
              earTagAssigned = true;
              assignedToAnimalId = existingTag.animal.id;
            } else {
              earTagId = existingTag.id;
            }
          }
        }

        rows.push({
          rowNumber,
          earTagNumber,
          earTagId,
          earTagAssigned,
          assignedToAnimalId,
          name: resolvedName,
          sex,
          dateOfBirth,
          usage,
          dateOfDeath,
          deathReason: dateOfDeath ? "died" : null,
          motherEarTagNumber,
          fatherEarTagNumber,
          parseErrors,
        });
      });

      return rows;
    },

    // Commit a (possibly user-modified) set of parsed rows to the DB. Each row either creates
    // a new animal or merges into an existing one (overwriting only the imported fields).
    async commitImport(rows: CommitImportRow[], type: AnimalType, farmId: string): Promise<CommitImportResult> {
      // Fetch all farm ear tags once — used for both create and merge paths
      const existingEarTags = await rlsDb.rls(async (tx) => {
        return tx.query.earTags.findMany({
          where: { farmId },
          with: { animal: true },
        });
      });
      // Mutable map keyed by lowercase number so we can add newly created tags
      const earTagByNumber = new Map(
        existingEarTags.map((tag) => [tag.number.toLowerCase(), tag as (typeof existingEarTags)[0]])
      );

      const skipped: CommitImportResult["skipped"] = [];

      // --- Create path (rows without mergeAnimalId) ---
      const createRows = rows.flatMap((r, i) => (!r.mergeAnimalId ? [{ row: r, index: i }] : []));

      // Determine which ear tag numbers need to be created
      const earTagsToCreate = new Set<string>();
      const validCreateRows: Array<{ row: CommitImportRow; index: number }> = [];
      for (const { row, index } of createRows) {
        if (row.earTagNumber && !row.earTagId) {
          const existing = earTagByNumber.get(row.earTagNumber.toLowerCase());
          if (existing?.animal) {
            skipped.push({ index, reason: t("animal_import.error_ear_tag_assigned", { number: row.earTagNumber }) });
            continue;
          }
          if (!existing) earTagsToCreate.add(row.earTagNumber);
        }
        validCreateRows.push({ row, index });
      }

      // Batch create missing ear tags and populate the map
      if (earTagsToCreate.size > 0) {
        const newEarTags = await rlsDb.rls(async (tx) => {
          return tx
            .insert(tables.earTags)
            .values(Array.from(earTagsToCreate).map((number) => ({ ...tables.farmIdColumnValue, number })))
            .returning();
        });
        for (const tag of newEarTags) {
          earTagByNumber.set(tag.number.toLowerCase(), { ...tag, animal: null });
        }
      }

      // Maps earTagNumber (lowercase) → newly created/merged animalId for parent resolution
      const importedEarTagToAnimalId = new Map<string, string>();

      let created = 0;
      if (validCreateRows.length > 0) {
        const animalsToInsert = validCreateRows.map(({ row }) => {
          // Prefer explicit earTagId from frontend, then look up by number
          const resolvedEarTagId = row.earTagId ?? earTagByNumber.get(row.earTagNumber?.toLowerCase() ?? "")?.id;
          return {
            ...tables.farmIdColumnValue,
            name: row.name,
            type,
            sex: row.sex,
            dateOfBirth: row.dateOfBirth,
            usage: row.usage,
            earTagId: resolvedEarTagId,
            registered: true,
            ...(row.dateOfDeath ? { dateOfDeath: row.dateOfDeath, deathReason: row.deathReason ?? "died" } : {}),
          };
        });

        const result = await rlsDb.rls(async (tx) => {
          return tx.insert(tables.animals).values(animalsToInsert).returning({ id: tables.animals.id });
        });
        created = result.length;

        // Map earTagNumber → created animalId for parent resolution below
        result.forEach(({ id }, i) => {
          const earTagNumber = validCreateRows[i].row.earTagNumber;
          if (earTagNumber) importedEarTagToAnimalId.set(earTagNumber.toLowerCase(), id);
        });
      }

      // --- Merge path (rows with mergeAnimalId) ---
      const mergeRows = rows.flatMap((r, i) => (r.mergeAnimalId ? [{ row: r, index: i }] : []));
      let merged = 0;

      for (const { row, index } of mergeRows) {
        const animalId = row.mergeAnimalId!;

        // Resolve the ear tag to assign (if any)
        let resolvedEarTagId: string | undefined;
        if (row.earTagId) {
          resolvedEarTagId = row.earTagId;
        } else if (row.earTagNumber) {
          const existing = earTagByNumber.get(row.earTagNumber.toLowerCase());
          if (existing) {
            if (existing.animal && existing.animal.id !== animalId) {
              skipped.push({ index, reason: t("animal_import.error_ear_tag_assigned", { number: row.earTagNumber }) });
              continue;
            }
            resolvedEarTagId = existing.id;
          } else {
            // Create the ear tag on the fly
            const [newTag] = await rlsDb.rls(async (tx) => {
              return tx
                .insert(tables.earTags)
                .values({ ...tables.farmIdColumnValue, number: row.earTagNumber! })
                .returning();
            });
            resolvedEarTagId = newTag.id;
            earTagByNumber.set(row.earTagNumber.toLowerCase(), { ...newTag, animal: null });
          }
        }

        await rlsDb.rls(async (tx) => {
          await tx
            .update(tables.animals)
            .set({
              name: row.name,
              sex: row.sex,
              dateOfBirth: row.dateOfBirth,
              usage: row.usage,
              ...(resolvedEarTagId !== undefined ? { earTagId: resolvedEarTagId } : {}),
              ...(row.dateOfDeath ? { dateOfDeath: row.dateOfDeath, deathReason: row.deathReason ?? "died" } : {}),
            })
            .where(eq(tables.animals.id, animalId));
        });

        // Track for parent resolution
        if (row.earTagNumber) importedEarTagToAnimalId.set(row.earTagNumber.toLowerCase(), animalId);

        merged++;
      }

      // --- Parent resolution (mother/father) ---
      // Resolve an ear tag number to an animal ID: check existing DB animals first, then this import batch
      const resolveParentId = (earTagNumber: string): string | undefined => {
        const tag = earTagByNumber.get(earTagNumber.toLowerCase());
        if (tag?.animal?.id) return tag.animal.id;
        return importedEarTagToAnimalId.get(earTagNumber.toLowerCase());
      };

      for (const row of rows) {
        if (!row.motherEarTagNumber && !row.fatherEarTagNumber) continue;

        // Determine this row's animalId (created or merged)
        const animalId =
          row.mergeAnimalId ??
          (row.earTagNumber ? importedEarTagToAnimalId.get(row.earTagNumber.toLowerCase()) : undefined);
        if (!animalId) continue;

        const motherId = row.motherEarTagNumber ? resolveParentId(row.motherEarTagNumber) : undefined;
        const fatherId = row.fatherEarTagNumber ? resolveParentId(row.fatherEarTagNumber) : undefined;
        if (!motherId && !fatherId) continue;

        await rlsDb.rls(async (tx) => {
          await tx
            .update(tables.animals)
            .set({
              ...(motherId ? { motherId } : {}),
              ...(fatherId ? { fatherId } : {}),
            })
            .where(eq(tables.animals.id, animalId));
        });
      }

      return { created, merged, skipped };
    },
  };
}
