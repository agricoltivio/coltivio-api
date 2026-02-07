import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { EarTag } from "../ear-tags/ear-tags";
import { Treatment } from "../treatments/treatments";

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

export type Herd = typeof tables.herds.$inferSelect;

export type AnimalCreateInput = Omit<
  typeof tables.animals.$inferInsert,
  "id" | "farmId"
>;
export type AnimalUpdateInput = Partial<AnimalCreateInput>;
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
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(tables.animals)
          .values({ ...tables.farmIdColumnValue, ...animalInput })
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
            treatments: true,
            herd: true,
          },
        });
      });
    },

    async getAnimalsForFarm(
      farmId: string,
      onlyLiving: boolean,
      animalTypes?: AnimalType[],
    ): Promise<Animal[]> {
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
    async updateAnimals(
      data: Array<AnimalUpdateInput & { id: string }>,
    ): Promise<Animal[]> {
      await rlsDb.rls(async (tx) => {
        await Promise.all(
          data.map(async ({ id, ...animal }) => {
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

    // Import animals from an Excel file buffer. Columns: A=ear tag, B=name, C=sex, D=date of birth
    async importFromExcel(
      fileBuffer: Buffer,
      type: AnimalType,
      skipHeaderRow: boolean,
      farmId: string,
    ): Promise<ImportResult> {
      // Load Excel workbook from buffer
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("Excel file has no worksheets");
      }

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

        const earTagNumber = row.getCell(1).text?.trim() || null;
        const name = row.getCell(2).text?.trim() || null;
        const sexValue = row.getCell(3).text?.trim().toLowerCase() || null;
        const dobCell = row.getCell(4);

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
          dateOfBirth,
          earTagId,
          earTagNumber: earTagNumber || undefined,
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

      // Assign ear tag IDs to animals that need new ear tags
      const animalsToCreate: AnimalCreateInput[] = validAnimals.map(
        (animal) => {
          const { earTagNumber, ...animalData } = animal;
          if (earTagNumber && !animalData.earTagId) {
            animalData.earTagId = newEarTagMap.get(earTagNumber.toLowerCase());
          }
          return animalData;
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
