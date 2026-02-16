import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import createHttpError from "http-errors";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { EarTag } from "../ear-tags/ear-tags";
import { Treatment } from "../treatments/treatments";
import { mapAnimalToCategory } from "./animal-key-mapping";
import { buildOutdoorJournal, OutdoorJournalResult } from "./outdoor-journal";

// SQL fragment to compute if animal has no active waiting times from treatments
const milkAndMeatUsableExtra = sql<boolean>`NOT EXISTS (
  SELECT 1 FROM ${tables.animalTreatments}
  JOIN ${tables.treatments} ON ${tables.treatments.id} = ${tables.animalTreatments.treatmentId}
  WHERE ${tables.animalTreatments.animalId} = ${tables.animals.id}
  AND (${tables.treatments.milkUsableDate} > NOW() OR ${tables.treatments.meatUsableDate} > NOW())
)`.as("milk_and_meat_usable");

// German sex value mapping for Excel imports
const SEX_MAP: Record<string, "male" | "female"> = {
  weiblich: "female",
  w: "female",
  geiss: "female",
  geiß: "female",
  männlich: "male",
  m: "male",
  bock: "male",
};

type AnimalUsage = (typeof tables.animalUsage.enumValues)[number];

// German usage value mapping for Excel imports
const USAGE_MAP: Record<string, AnimalUsage> = {
  milch: "milk",
  milk: "milk",
  andere: "other",
  other: "other",
};

// Header name to logical field mapping, keyed by locale
const HEADER_MAP: Record<string, Record<string, string>> = {
  de: {
    ohrmarkennummer: "earTag",
    tiername: "name",
    geschlecht: "sex",
    geburtsdatum: "dateOfBirth",
    nutzungsart: "usage",
  },
};

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
export type OutdoorScheduleRecurrence =
  typeof tables.outdoorScheduleRecurrences.$inferSelect;

export type OutdoorScheduleWithRecurrence = OutdoorSchedule & {
  recurrence: OutdoorScheduleRecurrence | null;
};
export type OutdoorScheduleType =
  (typeof tables.outdoorScheduleType.enumValues)[number];

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

// Pure date validation: checks if newRange overlaps with any existing range.
// null end = infinity (always overlaps with future dates).
export function hasScheduleOverlap(
  existingRanges: { start: Date; end: Date | null }[],
  newRange: { start: Date; end: Date | null },
): boolean {
  for (const existing of existingRanges) {
    const existingEnd = existing.end ?? new Date("9999-12-31");
    const newEnd = newRange.end ?? new Date("9999-12-31");
    if (newRange.start <= existingEnd && newEnd >= existing.start) {
      return true;
    }
  }
  return false;
}

// Compute effective date range for a schedule (considering recurrence)
function effectiveRange(schedule: OutdoorScheduleWithRecurrence): {
  start: Date;
  end: Date | null;
} {
  if (schedule.recurrence) {
    const until = schedule.recurrence.until
      ? new Date(schedule.recurrence.until)
      : null;
    return { start: schedule.startDate, end: until };
  }
  return { start: schedule.startDate, end: schedule.endDate };
}

export type AnimalCreateInput = Omit<
  typeof tables.animals.$inferInsert,
  "id" | "farmId"
>;
export type AnimalUpdateInput = Partial<AnimalCreateInput>;
export type BatchUpdateAnimalInput = {
  type?: AnimalType;
  categoryOverride?: AnimalCategory;
  requiresCategoryOverride?: boolean;
  usage?: AnimalUsage;
  registered?: boolean;
  dateOfDeath?: Date;
  deathReason?: AnimalDeathReason;
  motherId?: string | null;
  fatherId?: string | null;
};
export type Animal = typeof tables.animals.$inferSelect & {
  earTag: EarTag | null;
};
export type AnimalWithRelations = Animal & {
  mother: Animal | null;
  father: Animal | null;
  childrenAsMother: Animal[];
  childrenAsFather: Animal[];
  treatments: Treatment[];
  herd: Herd | null;
};

export function animalsApi(rlsDb: RlsDb) {
  return {
    async createAnimal(animalInput: AnimalCreateInput): Promise<Animal> {
      // Check if animal can be mapped to a category; if not, flag it
      const requiresCategoryOverride =
        animalInput.dateOfBirth && animalInput.sex && animalInput.type
          ? mapAnimalToCategory(
              {
                type: animalInput.type,
                sex: animalInput.sex,
                usage: animalInput.usage ?? "other",
                dateOfBirth: animalInput.dateOfBirth,
                categoryOverride: animalInput.categoryOverride ?? null,
              },
              new Date(),
            ) === null
          : false;

      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(tables.animals)
          .values({
            ...tables.farmIdColumnValue,
            ...animalInput,
            requiresCategoryOverride,
          })
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
      animalTypes?: AnimalType[],
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

    async updateAnimals(
      data: Array<AnimalUpdateInput & { id: string }>,
    ): Promise<Animal[]> {
      await rlsDb.rls(async (tx) => {
        await Promise.all(
          data.map(async ({ id, ...animal }) => {
            if (animal.categoryOverride) {
              animal.requiresCategoryOverride = false;
            }
            await tx
              .update(tables.animals)
              .set(animal)
              .where(eq(tables.animals.id, id));
          }),
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
        if (data.categoryOverride) {
          data.requiresCategoryOverride = false;
        }
        const [result] = await tx
          .update(tables.animals)
          .set(data)
          .where(eq(tables.animals.id, id))
          .returning({ id: tables.animals.id });
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

    async batchUpdateAnimals(
      animalIds: string[],
      data: BatchUpdateAnimalInput,
    ): Promise<Animal[]> {
      return rlsDb.rls(async (tx) => {
        if (data.categoryOverride) {
          data.requiresCategoryOverride = false;
        }
        await tx
          .update(tables.animals)
          .set(data)
          .where(inArray(tables.animals.id, animalIds));
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
        await tx
          .delete(tables.animals)
          .where(inArray(tables.animals.id, animalIds));
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

    async createHerd(input: { name: string }, animalIds: string[]) {
      return rlsDb.rls(async (tx) => {
        const [herd] = await tx
          .insert(tables.herds)
          .values({ ...tables.farmIdColumnValue, ...input })
          .returning();

        if (animalIds.length > 0) {
          // Update denormalized herdId on animals
          await tx
            .update(tables.animals)
            .set({ herdId: herd.id })
            .where(inArray(tables.animals.id, animalIds));

          // Close any active memberships and create new ones
          const today = new Date();
          for (const animalId of animalIds) {
            await tx
              .update(tables.herdMemberships)
              .set({ toDate: today })
              .where(
                and(
                  eq(tables.herdMemberships.animalId, animalId),
                  isNull(tables.herdMemberships.toDate),
                ),
              );
            await tx.insert(tables.herdMemberships).values({
              ...tables.farmIdColumnValue,
              animalId,
              herdId: herd.id,
              fromDate: today,
            });
          }
        }

        return herd;
      });
    },

    async updateHerd(
      id: string,
      input: { name?: string },
      animalIds?: string[],
    ) {
      return rlsDb.rls(async (tx) => {
        const [herd] = await tx
          .update(tables.herds)
          .set(input)
          .where(eq(tables.herds.id, id))
          .returning();

        // If animalIds provided, replace all assignments: clear existing, set new
        if (animalIds !== undefined) {
          const today = new Date();

          // Close all active memberships for this herd
          await tx
            .update(tables.herdMemberships)
            .set({ toDate: today })
            .where(
              and(
                eq(tables.herdMemberships.herdId, id),
                isNull(tables.herdMemberships.toDate),
              ),
            );

          // Update denormalized herdId on animals
          await tx
            .update(tables.animals)
            .set({ herdId: null })
            .where(eq(tables.animals.herdId, id));

          if (animalIds.length > 0) {
            await tx
              .update(tables.animals)
              .set({ herdId: id })
              .where(inArray(tables.animals.id, animalIds));

            // Close any other active membership for each animal, then create new
            for (const animalId of animalIds) {
              await tx
                .update(tables.herdMemberships)
                .set({ toDate: today })
                .where(
                  and(
                    eq(tables.herdMemberships.animalId, animalId),
                    isNull(tables.herdMemberships.toDate),
                  ),
                );
              await tx.insert(tables.herdMemberships).values({
                ...tables.farmIdColumnValue,
                animalId,
                herdId: id,
                fromDate: today,
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
      input: OutdoorScheduleCreateInput,
    ): Promise<OutdoorScheduleWithRecurrence> {
      const { recurrence, ...scheduleInput } = input;

      // Validate no overlap with existing schedules for this herd
      const existing = await this.getOutdoorSchedulesForHerd(herdId);
      const existingRanges = existing.map(effectiveRange);
      const newRecurrenceUntil = recurrence?.until
        ? new Date(recurrence.until)
        : null;
      const newRange = recurrence
        ? { start: scheduleInput.startDate, end: newRecurrenceUntil }
        : {
            start: scheduleInput.startDate,
            end: scheduleInput.endDate ?? null,
          };

      if (hasScheduleOverlap(existingRanges, newRange)) {
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

    async updateOutdoorSchedule(
      id: string,
      input: OutdoorScheduleUpdateInput,
    ): Promise<OutdoorScheduleWithRecurrence> {
      const { recurrence, ...scheduleData } = input;

      // Fetch current schedule to know its herdId
      const current = await this.getOutdoorScheduleById(id);
      if (!current) {
        throw createHttpError(404, "Outdoor schedule not found");
      }

      // Validate no overlap (exclude self)
      if (
        scheduleData.startDate !== undefined ||
        scheduleData.endDate !== undefined ||
        recurrence !== undefined
      ) {
        const existing = await this.getOutdoorSchedulesForHerd(current.herdId);
        const existingRanges = existing
          .filter((s) => s.id !== id)
          .map(effectiveRange);

        const updatedStartDate = scheduleData.startDate ?? current.startDate;
        const updatedEndDate =
          scheduleData.endDate !== undefined
            ? scheduleData.endDate
            : current.endDate;

        let updatedRange: { start: Date; end: Date | null };
        if (recurrence !== undefined) {
          if (recurrence) {
            const until = recurrence.until ? new Date(recurrence.until) : null;
            updatedRange = { start: updatedStartDate, end: until };
          } else {
            updatedRange = { start: updatedStartDate, end: updatedEndDate };
          }
        } else if (current.recurrence) {
          const until = current.recurrence.until
            ? new Date(current.recurrence.until)
            : null;
          updatedRange = { start: updatedStartDate, end: until };
        } else {
          updatedRange = { start: updatedStartDate, end: updatedEndDate };
        }

        if (hasScheduleOverlap(existingRanges, updatedRange)) {
          throw createHttpError(
            409,
            "Schedule overlaps with existing schedule",
          );
        }
      }

      await rlsDb.rls(async (tx) => {
        // Update schedule fields if any provided
        if (Object.keys(scheduleData).length > 0) {
          await tx
            .update(tables.outdoorSchedules)
            .set(scheduleData)
            .where(eq(tables.outdoorSchedules.id, id));
        }

        // Handle recurrence upsert/delete
        if (recurrence !== undefined) {
          const existingRecurrence =
            await tx.query.outdoorScheduleRecurrences.findFirst({
              where: { outdoorScheduleId: id },
            });

          if (recurrence === null) {
            if (existingRecurrence) {
              await tx
                .delete(tables.outdoorScheduleRecurrences)
                .where(
                  eq(tables.outdoorScheduleRecurrences.outdoorScheduleId, id),
                );
            }
          } else if (existingRecurrence) {
            await tx
              .update(tables.outdoorScheduleRecurrences)
              .set(recurrence)
              .where(
                eq(tables.outdoorScheduleRecurrences.outdoorScheduleId, id),
              );
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
        await tx
          .delete(tables.outdoorSchedules)
          .where(eq(tables.outdoorSchedules.id, id));
      });
    },

    async getHerdsWithMembershipsForFarm(farmId: string) {
      return rlsDb.rls(async (tx) => {
        return tx.query.herds.findMany({
          where: { farmId },
          with: {
            herdMemberships: {
              with: { animal: { with: { earTag: true } } },
            },
            outdoorSchedules: { with: { recurrence: true } },
          },
        });
      });
    },

    async getOutdoorJournal(
      farmId: string,
      fromDate: Date,
      toDate: Date,
    ): Promise<OutdoorJournalResult> {
      const herds = await this.getHerdsWithMembershipsForFarm(farmId);
      return buildOutdoorJournal(herds, fromDate, toDate);
    },

    // Import animals from an Excel file buffer. Uses header row to detect columns by name.
    async importFromExcel(
      fileBuffer: Buffer,
      type: AnimalType,
      skipHeaderRow: boolean,
      farmId: string,
      locale: string = "de",
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

      if (skipHeaderRow) {
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
      }

      // Fallback to positional columns if headers weren't detected
      if (!columnIndex["earTag"]) columnIndex["earTag"] = 1;
      if (!columnIndex["name"]) columnIndex["name"] = 2;
      if (!columnIndex["sex"]) columnIndex["sex"] = 3;
      if (!columnIndex["dateOfBirth"]) columnIndex["dateOfBirth"] = 4;
      // usage has no positional fallback — it's optional if header not found

      // Fetch all existing ear tags for this farm to check for duplicates (with animal assignment info)
      const existingEarTags = await rlsDb.rls(async (tx) => {
        return tx.query.earTags.findMany({
          where: { farmId },
          with: { animal: { with: { earTag: true } } },
        });
      });
      const earTagByNumber = new Map(
        existingEarTags.map((tag) => [tag.number.toLowerCase(), tag]),
      );

      const skippedRows: SkippedRow[] = [];
      const validAnimals: (AnimalCreateInput & { earTagNumber?: string })[] =
        [];
      const earTagsToCreate = new Set<string>();

      // Process rows
      let rowIndex = 0;
      worksheet.eachRow((row, rowNumber) => {
        rowIndex++;
        if (skipHeaderRow && rowNumber === 1) return;

        const earTagNumber =
          row.getCell(columnIndex["earTag"]).text?.trim() || null;
        const name = row.getCell(columnIndex["name"]).text?.trim() || null;
        const sexValue =
          row.getCell(columnIndex["sex"]).text?.trim().toLowerCase() || null;
        const dobCell = row.getCell(columnIndex["dateOfBirth"]);
        const usageValue = columnIndex["usage"]
          ? row.getCell(columnIndex["usage"]).text?.trim().toLowerCase() || null
          : null;

        if (!name) {
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
            const parsed = new Date(dobCell.value);
            if (isNaN(parsed.getTime())) {
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
            dateOfBirth = new Date(
              Math.round((dobCell.value - 25569) * 86400 * 1000),
            );
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
          name,
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
              })),
            )
            .returning();
        });
      }
      const newEarTagMap = new Map(
        newEarTags.map((tag) => [tag.number.toLowerCase(), tag.id]),
      );

      // Assign ear tag IDs and compute requiresCategoryOverride
      const animalsToCreate: AnimalCreateInput[] = validAnimals.map(
        (animal) => {
          const { earTagNumber, ...animalData } = animal;
          if (earTagNumber && !animalData.earTagId) {
            animalData.earTagId = newEarTagMap.get(earTagNumber.toLowerCase());
          }
          const requiresCategoryOverride =
            mapAnimalToCategory(
              {
                type: animalData.type!,
                sex: animalData.sex!,
                usage: animalData.usage ?? "other",
                dateOfBirth: animalData.dateOfBirth!,
                categoryOverride: null,
              },
              new Date(),
            ) === null;
          return { ...animalData, requiresCategoryOverride };
        },
      );

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
              })),
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
  };
}
