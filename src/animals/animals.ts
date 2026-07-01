import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import createHttpError from "http-errors";
import { appDrizzle } from "../db/db";
import * as tables from "../db/schema";
import { EarTag } from "../ear-tags/ear-tags";
import { Treatment } from "../treatments/treatments";
import { buildOutdoorJournal, expandOutdoorSchedule, OutdoorJournalResult } from "./outdoor-journal";

const SEX_MAP: Record<string, "male" | "female"> = {
  weiblich: "female",
  w: "female",
  geiss: "female",
  geiß: "female",
  männlich: "male",
  m: "male",
  bock: "male",
  femmina: "female",
  maschio: "male",
  femelle: "female",
  mâle: "male",
};

type AnimalUsage = (typeof tables.animalUsage.enumValues)[number];

const USAGE_MAP: Record<string, AnimalUsage> = {
  milch: "milk",
  milk: "milk",
  andere: "other",
  other: "other",
  "nicht definiert": "other",
  latte: "milk",
  "non definito": "other",
  altro: "other",
  lait: "milk",
  "non défini": "other",
  autre: "other",
};

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
  summary: { totalRows: number; imported: number; skipped: number };
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
export type Animal = typeof tables.animals.$inferSelect & { earTag: EarTag | null };

export type ParsedImportRow = {
  rowNumber: number;
  earTagNumber: string | null;
  earTagId: string | null;
  earTagAssigned: boolean;
  assignedToAnimalId: string | null;
  name: string | null;
  sex: "male" | "female" | null;
  dateOfBirth: Date | null;
  usage: AnimalUsage | null;
  dateOfDeath: Date | null;
  deathReason: AnimalDeathReason | null;
  motherEarTagNumber: string | null;
  fatherEarTagNumber: string | null;
  parseErrors: string[];
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
  mergeAnimalId?: string | null;
};

export type CommitImportResult = {
  created: number;
  merged: number;
  skipped: Array<{ index: number; reason: string }>;
};

export type FamilyTreeNode = {
  id: string;
  name: string;
  earTagNumber: string | null;
  dateOfBirth: Date;
  dateOfDeath: Date | null;
  sex: "male" | "female";
};

export type FamilyTreeEdge = { parentId: string; childId: string; relation: "mother" | "father" };

export type FamilyTreeResult = { nodes: FamilyTreeNode[]; edges: FamilyTreeEdge[] };

export type AnimalWithRelations = Animal & {
  mother: Animal | null;
  father: Animal | null;
  childrenAsMother: Animal[];
  childrenAsFather: Animal[];
  treatments: Treatment[];
  herd: Herd | null;
  customOutdoorJournalCategories: CustomOutdoorJournalCategory[];
};

export async function createAnimal(animalInput: AnimalCreateInput, farmId: string): Promise<Animal> {
  const result = await appDrizzle.transaction(async (tx) => {
    const [created] = await tx
      .insert(tables.animals)
      .values({ farmId, ...animalInput })
      .returning();

    if (animalInput.herdId) {
      await tx
        .insert(tables.herdMemberships)
        .values({ farmId, animalId: created.id, herdId: animalInput.herdId, fromDate: new Date() });
    }

    return created;
  });

  const animal = await appDrizzle.query.animals.findFirst({ where: { id: result.id }, with: { earTag: true } });
  return animal!;
}

export async function getAnimalById(id: string): Promise<AnimalWithRelations | undefined> {
  const result = await appDrizzle.query.animals.findFirst({
    where: { id },
    with: {
      earTag: true,
      mother: { with: { earTag: true } },
      father: { with: { earTag: true } },
      childrenAsFather: { with: { earTag: true } },
      childrenAsMother: { with: { earTag: true } },
      animalTreatments: { with: { treatment: true } },
      herd: true,
      customOutdoorJournalCategories: true,
    },
  });
  if (!result) return undefined;
  return { ...result, treatments: result.animalTreatments.map((at) => at.treatment) };
}

export async function getAnimalsForFarm(
  farmId: string,
  onlyLiving: boolean,
  animalTypes?: AnimalType[]
): Promise<Array<Animal & { milkAndMeatUsable: boolean }>> {
  return appDrizzle.query.animals.findMany({
    where: {
      farmId,
      type: animalTypes ? { in: animalTypes } : undefined,
      dateOfDeath: onlyLiving ? { isNull: true } : undefined,
    },
    with: { earTag: true },
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
}

export async function getFamilyTree(farmId: string, type: AnimalType): Promise<FamilyTreeResult> {
  const allAnimals = await appDrizzle.query.animals.findMany({ where: { farmId, type }, with: { earTag: true } });
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
    if (a.motherId && animalIds.has(a.motherId))
      edges.push({ parentId: a.motherId, childId: a.id, relation: "mother" });
    if (a.fatherId && animalIds.has(a.fatherId))
      edges.push({ parentId: a.fatherId, childId: a.id, relation: "father" });
  }
  return { nodes, edges };
}

export async function updateAnimals(
  data: Array<AnimalUpdateInput & { id: string }>,
  farmId: string
): Promise<Animal[]> {
  await appDrizzle.transaction(async (tx) => {
    const today = new Date();
    await Promise.all(
      data.map(async ({ id, ...animal }) => {
        await tx.update(tables.animals).set(animal).where(eq(tables.animals.id, id));

        if (animal.herdId !== undefined) {
          await tx
            .update(tables.herdMemberships)
            .set({ toDate: today })
            .where(and(eq(tables.herdMemberships.animalId, id), isNull(tables.herdMemberships.toDate)));
          if (animal.herdId) {
            await tx
              .insert(tables.herdMemberships)
              .values({ farmId, animalId: id, herdId: animal.herdId, fromDate: today });
          }
        }
      })
    );
  });
  return appDrizzle.query.animals.findMany({ where: { id: { in: data.map(({ id }) => id) } }, with: { earTag: true } });
}

export async function updateAnimal(id: string, data: AnimalUpdateInput, farmId: string): Promise<Animal> {
  const [result] = await appDrizzle
    .update(tables.animals)
    .set(data)
    .where(eq(tables.animals.id, id))
    .returning({ id: tables.animals.id, herdId: tables.animals.herdId });

  if (data.herdId !== undefined) {
    const today = new Date();
    await appDrizzle
      .update(tables.herdMemberships)
      .set({ toDate: today })
      .where(and(eq(tables.herdMemberships.animalId, id), isNull(tables.herdMemberships.toDate)));
    if (data.herdId) {
      await appDrizzle
        .insert(tables.herdMemberships)
        .values({ farmId, animalId: id, herdId: data.herdId, fromDate: today });
    }
  }

  const animal = await appDrizzle.query.animals.findFirst({ where: { id: result.id }, with: { earTag: true } });
  return animal!;
}

export async function batchUpdateAnimals(animalIds: string[], data: BatchUpdateAnimalInput): Promise<Animal[]> {
  await appDrizzle.update(tables.animals).set(data).where(inArray(tables.animals.id, animalIds));
  return appDrizzle.query.animals.findMany({ where: { id: { in: animalIds } }, with: { earTag: true } });
}

export async function deleteAnimals(animalIds: string[]): Promise<void> {
  await appDrizzle.delete(tables.animals).where(inArray(tables.animals.id, animalIds));
}

export async function deleteAnimal(id: string): Promise<void> {
  await appDrizzle.delete(tables.animals).where(eq(tables.animals.id, id));
}

export async function getChildrenOfAnimal(animalId: string): Promise<Animal[]> {
  return appDrizzle.query.animals.findMany({
    where: { OR: [{ motherId: animalId }, { fatherId: animalId }] },
    with: { earTag: true },
  });
}

export async function getHerdsForFarm(farmId: string) {
  return appDrizzle.query.herds.findMany({
    where: { farmId },
    with: { animals: { with: { earTag: true } }, outdoorSchedules: { with: { recurrence: true } } },
  });
}

export async function getHerdById(id: string) {
  return appDrizzle.query.herds.findFirst({
    where: { id },
    with: { animals: { with: { earTag: true } }, outdoorSchedules: { with: { recurrence: true } } },
  });
}

export async function createHerd(
  input: { name: string },
  animalIds: string[],
  farmId: string,
  outdoorSchedules?: OutdoorScheduleCreateInput[]
) {
  if (outdoorSchedules?.length) {
    if (hasScheduleOverlap(outdoorSchedules.map(inputToSchedule))) {
      throw createHttpError(409, "Schedule overlaps with another schedule");
    }
  }

  return appDrizzle.transaction(async (tx) => {
    const [herd] = await tx
      .insert(tables.herds)
      .values({ farmId, ...input })
      .returning();

    if (animalIds.length > 0) {
      await tx.update(tables.animals).set({ herdId: herd.id }).where(inArray(tables.animals.id, animalIds));

      const today = new Date();
      const earliestScheduleStart =
        outdoorSchedules && outdoorSchedules.length > 0
          ? outdoorSchedules.reduce(
              (earliest, s) => (s.startDate < earliest ? s.startDate : earliest),
              outdoorSchedules[0].startDate
            )
          : null;
      const membershipFromDate = earliestScheduleStart && earliestScheduleStart < today ? earliestScheduleStart : today;

      for (const animalId of animalIds) {
        await tx
          .update(tables.herdMemberships)
          .set({ toDate: membershipFromDate })
          .where(and(eq(tables.herdMemberships.animalId, animalId), isNull(tables.herdMemberships.toDate)));
        await tx
          .insert(tables.herdMemberships)
          .values({ farmId, animalId, herdId: herd.id, fromDate: membershipFromDate });
      }
    }

    if (outdoorSchedules?.length) {
      for (const { recurrence, ...scheduleInput } of outdoorSchedules) {
        const [schedule] = await tx
          .insert(tables.outdoorSchedules)
          .values({ farmId, herdId: herd.id, ...scheduleInput })
          .returning();
        if (recurrence) {
          await tx
            .insert(tables.outdoorScheduleRecurrences)
            .values({ farmId, outdoorScheduleId: schedule.id, ...recurrence });
        }
      }
    }

    return herd;
  });
}

export async function updateHerd(
  id: string,
  input: { name?: string },
  farmId: string,
  animalIds?: string[],
  outdoorSchedules?: OutdoorScheduleCreateInput[]
) {
  if (outdoorSchedules?.length) {
    if (hasScheduleOverlap(outdoorSchedules.map(inputToSchedule))) {
      throw createHttpError(409, "Schedule overlaps with another schedule");
    }
  }

  return appDrizzle.transaction(async (tx) => {
    const [herd] =
      Object.keys(input).length > 0
        ? await tx.update(tables.herds).set(input).where(eq(tables.herds.id, id)).returning()
        : await tx.query.herds.findMany({ where: { id }, limit: 1 });

    if (animalIds !== undefined) {
      const today = new Date();
      await tx
        .update(tables.herdMemberships)
        .set({ toDate: today })
        .where(and(eq(tables.herdMemberships.herdId, id), isNull(tables.herdMemberships.toDate)));
      await tx.update(tables.animals).set({ herdId: null }).where(eq(tables.animals.herdId, id));

      if (animalIds.length > 0) {
        await tx.update(tables.animals).set({ herdId: id }).where(inArray(tables.animals.id, animalIds));
        for (const animalId of animalIds) {
          await tx
            .update(tables.herdMemberships)
            .set({ toDate: today })
            .where(and(eq(tables.herdMemberships.animalId, animalId), isNull(tables.herdMemberships.toDate)));
          await tx.insert(tables.herdMemberships).values({ farmId, animalId, herdId: id, fromDate: today });
        }
      }
    }

    if (outdoorSchedules !== undefined) {
      await tx.delete(tables.outdoorSchedules).where(eq(tables.outdoorSchedules.herdId, id));
      for (const { recurrence, ...scheduleInput } of outdoorSchedules) {
        const [schedule] = await tx
          .insert(tables.outdoorSchedules)
          .values({ farmId, herdId: id, ...scheduleInput })
          .returning();
        if (recurrence) {
          await tx
            .insert(tables.outdoorScheduleRecurrences)
            .values({ farmId, outdoorScheduleId: schedule.id, ...recurrence });
        }
      }
    }

    return herd;
  });
}

export async function deleteHerd(id: string): Promise<void> {
  await appDrizzle.delete(tables.herds).where(eq(tables.herds.id, id));
}

export async function getOutdoorSchedulesForHerd(herdId: string) {
  return appDrizzle.query.outdoorSchedules.findMany({ where: { herdId }, with: { recurrence: true } });
}

export async function getOutdoorScheduleById(id: string) {
  return appDrizzle.query.outdoorSchedules.findFirst({ where: { id }, with: { recurrence: true } });
}

export async function createOutdoorSchedule(
  herdId: string,
  input: OutdoorScheduleCreateInput,
  farmId: string
): Promise<OutdoorScheduleWithRecurrence> {
  const { recurrence, ...scheduleInput } = input;

  const existing = await getOutdoorSchedulesForHerd(herdId);
  if (hasScheduleOverlap([...existing, inputToSchedule(input)])) {
    throw createHttpError(409, "Schedule overlaps with existing schedule");
  }

  const result = await appDrizzle.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(tables.outdoorSchedules)
      .values({ farmId, herdId, ...scheduleInput })
      .returning();
    if (recurrence) {
      await tx
        .insert(tables.outdoorScheduleRecurrences)
        .values({ farmId, outdoorScheduleId: schedule.id, ...recurrence });
    }
    return schedule;
  });

  const created = await getOutdoorScheduleById(result.id);
  return created!;
}

export async function updateOutdoorSchedule(
  id: string,
  input: OutdoorScheduleUpdateInput,
  farmId: string
): Promise<OutdoorScheduleWithRecurrence> {
  const { recurrence, ...scheduleData } = input;

  const current = await getOutdoorScheduleById(id);
  if (!current) throw createHttpError(404, "Outdoor schedule not found");

  if (scheduleData.startDate !== undefined || scheduleData.endDate !== undefined || recurrence !== undefined) {
    const existing = await getOutdoorSchedulesForHerd(current.herdId);
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

  await appDrizzle.transaction(async (tx) => {
    if (Object.keys(scheduleData).length > 0) {
      await tx.update(tables.outdoorSchedules).set(scheduleData).where(eq(tables.outdoorSchedules.id, id));
    }

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
        await tx.insert(tables.outdoorScheduleRecurrences).values({ farmId, outdoorScheduleId: id, ...recurrence });
      }
    }
  });

  const updated = await getOutdoorScheduleById(id);
  return updated!;
}

export async function deleteOutdoorSchedule(id: string): Promise<void> {
  await appDrizzle.delete(tables.outdoorSchedules).where(eq(tables.outdoorSchedules.id, id));
}

export async function setCustomOutdoorJournalCategories(
  animalId: string,
  entries: { startDate: Date; endDate?: Date | null; category: AnimalCategory }[],
  farmId: string
): Promise<CustomOutdoorJournalCategory[]> {
  const rangeSchedules = entries.map((e) =>
    inputToSchedule({ startDate: e.startDate, endDate: e.endDate, type: "pasture", recurrence: null })
  );
  if (hasScheduleOverlap(rangeSchedules)) {
    throw createHttpError(409, "Custom outdoor journal category date ranges overlap");
  }

  return appDrizzle.transaction(async (tx) => {
    await tx
      .delete(tables.customOutdoorJournalCategories)
      .where(eq(tables.customOutdoorJournalCategories.animalId, animalId));
    if (entries.length === 0) return [];
    return tx
      .insert(tables.customOutdoorJournalCategories)
      .values(
        entries.map((e) => ({
          farmId,
          animalId,
          startDate: e.startDate,
          endDate: e.endDate ?? null,
          category: e.category,
        }))
      )
      .returning();
  });
}

export async function getHerdsWithMembershipsForFarm(farmId: string) {
  return appDrizzle.query.herds.findMany({
    where: { farmId },
    with: {
      herdMemberships: { with: { animal: { with: { earTag: true, customOutdoorJournalCategories: true } } } },
      outdoorSchedules: { with: { recurrence: true } },
    },
  });
}

export async function getOutdoorJournal(farmId: string, fromDate: Date, toDate: Date): Promise<OutdoorJournalResult> {
  const herds = await getHerdsWithMembershipsForFarm(farmId);
  return buildOutdoorJournal(herds, fromDate, toDate);
}

export async function importFromExcel(
  fileBuffer: Buffer,
  type: AnimalType,
  skipHeaderRow: boolean,
  farmId: string,
  locale: string = "de"
): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel file has no worksheets");

  const headerMap = HEADER_MAP[locale] ?? HEADER_MAP["de"];
  const columnIndex: Record<string, number> = {};

  if (!skipHeaderRow) throw createHttpError(400, "A header row is required for import.");

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const headerText = cell.text?.trim().toLowerCase();
    if (headerText) {
      const field = headerMap[headerText];
      if (field) columnIndex[field] = colNumber;
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

  const existingEarTags = await appDrizzle.query.earTags.findMany({
    where: { farmId },
    with: { animal: { with: { earTag: true } } },
  });
  const earTagByNumber = new Map(existingEarTags.map((tag) => [tag.number.toLowerCase(), tag]));

  const skippedRows: SkippedRow[] = [];
  const validAnimals: (AnimalCreateInput & { earTagNumber?: string })[] = [];
  const earTagsToCreate = new Set<string>();

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
      skippedRows.push({ row: rowNumber, earTagNumber, name, reason: "Name is required" });
      return;
    }
    if (!sexValue) {
      skippedRows.push({ row: rowNumber, earTagNumber, name, reason: "Sex is required" });
      return;
    }

    const sex = SEX_MAP[sexValue];
    if (!sex) {
      skippedRows.push({ row: rowNumber, earTagNumber, name, reason: `Unknown sex value: ${sexValue}` });
      return;
    }

    let usage: AnimalUsage = "other";
    if (usageValue) {
      const mapped = USAGE_MAP[usageValue];
      if (mapped) usage = mapped;
    }

    let dateOfBirth: Date;
    if (dobCell.value) {
      if (dobCell.value instanceof Date) {
        dateOfBirth = dobCell.value;
      } else if (typeof dobCell.value === "string") {
        const parsed = parseDateString(dobCell.value);
        if (!parsed) {
          skippedRows.push({ row: rowNumber, earTagNumber, name, reason: "Invalid date format" });
          return;
        }
        dateOfBirth = parsed;
      } else if (typeof dobCell.value === "number") {
        dateOfBirth = new Date(Math.round((dobCell.value - 25569) * 86400 * 1000));
      } else {
        skippedRows.push({ row: rowNumber, earTagNumber, name, reason: "Invalid date format" });
        return;
      }
    } else {
      skippedRows.push({ row: rowNumber, earTagNumber, name, reason: "Date of birth is required" });
      return;
    }

    let earTagId: string | undefined;
    if (earTagNumber) {
      const existingTag = earTagByNumber.get(earTagNumber.toLowerCase());
      if (existingTag) {
        if (existingTag.animal) {
          skippedRows.push({ row: rowNumber, earTagNumber, name, reason: "Ear tag already assigned" });
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

  const earTagNumbersToCreate = Array.from(earTagsToCreate);
  let newEarTags: EarTag[] = [];
  if (earTagNumbersToCreate.length > 0) {
    newEarTags = await appDrizzle
      .insert(tables.earTags)
      .values(earTagNumbersToCreate.map((number) => ({ farmId, number })))
      .returning();
  }
  const newEarTagMap = new Map(newEarTags.map((tag) => [tag.number.toLowerCase(), tag.id]));

  const animalsToCreate: AnimalCreateInput[] = validAnimals.map((animal) => {
    const { earTagNumber, ...animalData } = animal;
    if (earTagNumber && !animalData.earTagId) animalData.earTagId = newEarTagMap.get(earTagNumber.toLowerCase());
    return animalData;
  });

  let importedCount = 0;
  if (animalsToCreate.length > 0) {
    const result = await appDrizzle
      .insert(tables.animals)
      .values(animalsToCreate.map((input) => ({ farmId, ...input })))
      .returning({ id: tables.animals.id });
    importedCount = result.length;
  }
  const totalRows = skipHeaderRow ? rowIndex - 1 : rowIndex;

  return { skipped: skippedRows, summary: { totalRows, imported: importedCount, skipped: skippedRows.length } };
}

export async function parseImportPreview(
  fileBuffer: Buffer,
  skipHeaderRow: boolean,
  farmId: string,
  locale: string = "de"
): Promise<ParsedImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel file has no worksheets");

  const headerMap = HEADER_MAP[locale] ?? HEADER_MAP["de"];
  const columnIndex: Record<string, number> = {};

  if (!skipHeaderRow) throw createHttpError(400, "A header row is required for import.");

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const headerText = cell.text?.trim().toLowerCase();
    if (headerText) {
      const field = headerMap[headerText];
      if (field) columnIndex[field] = colNumber;
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

  const existingEarTags = await appDrizzle.query.earTags.findMany({ where: { farmId }, with: { animal: true } });
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
    if (!resolvedName) parseErrors.push("Name is required");

    let sex: "male" | "female" | null = null;
    if (!sexValue) {
      parseErrors.push("Sex is required");
    } else {
      sex = SEX_MAP[sexValue] ?? null;
      if (!sex) parseErrors.push(`Unknown sex value: ${sexValue}`);
    }

    const usage: AnimalUsage = usageValue ? (USAGE_MAP[usageValue] ?? "other") : "other";

    let dateOfBirth: Date | null = null;
    if (!dobCell.value) {
      parseErrors.push("Date of birth is required");
    } else if (dobCell.value instanceof Date) {
      dateOfBirth = dobCell.value;
    } else if (typeof dobCell.value === "string") {
      const parsed = parseDateString(dobCell.value);
      if (!parsed) parseErrors.push("Invalid date of birth format");
      else dateOfBirth = parsed;
    } else if (typeof dobCell.value === "number") {
      dateOfBirth = new Date(Math.round((dobCell.value - 25569) * 86400 * 1000));
    } else {
      parseErrors.push("Invalid date of birth format");
    }

    let dateOfDeath: Date | null = null;
    if (dodCell?.value) {
      if (dodCell.value instanceof Date) dateOfDeath = dodCell.value;
      else if (typeof dodCell.value === "string") dateOfDeath = parseDateString(dodCell.value);
      else if (typeof dodCell.value === "number")
        dateOfDeath = new Date(Math.round((dodCell.value - 25569) * 86400 * 1000));
    }

    let earTagId: string | null = null;
    let earTagAssigned = false;
    let assignedToAnimalId: string | null = null;
    if (earTagNumber) {
      const existingTag = earTagByNumber.get(earTagNumber.toLowerCase());
      if (existingTag) {
        if (existingTag.animal) {
          earTagAssigned = true;
          assignedToAnimalId = existingTag.animal.id;
        } else earTagId = existingTag.id;
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
}

export async function commitImport(
  rows: CommitImportRow[],
  type: AnimalType,
  farmId: string
): Promise<CommitImportResult> {
  const existingEarTags = await appDrizzle.query.earTags.findMany({ where: { farmId }, with: { animal: true } });
  const earTagByNumber = new Map(
    existingEarTags.map((tag) => [tag.number.toLowerCase(), tag as (typeof existingEarTags)[0]])
  );

  const skipped: CommitImportResult["skipped"] = [];
  const createRows = rows.flatMap((r, i) => (!r.mergeAnimalId ? [{ row: r, index: i }] : []));

  const earTagsToCreate = new Set<string>();
  const validCreateRows: Array<{ row: CommitImportRow; index: number }> = [];
  for (const { row, index } of createRows) {
    if (row.earTagNumber && !row.earTagId) {
      const existing = earTagByNumber.get(row.earTagNumber.toLowerCase());
      if (existing?.animal) {
        skipped.push({ index, reason: `Ear tag already assigned: ${row.earTagNumber}` });
        continue;
      }
      if (!existing) earTagsToCreate.add(row.earTagNumber);
    }
    validCreateRows.push({ row, index });
  }

  if (earTagsToCreate.size > 0) {
    const newEarTags = await appDrizzle
      .insert(tables.earTags)
      .values(Array.from(earTagsToCreate).map((number) => ({ farmId, number })))
      .returning();
    for (const tag of newEarTags) earTagByNumber.set(tag.number.toLowerCase(), { ...tag, animal: null });
  }

  const importedEarTagToAnimalId = new Map<string, string>();
  let created = 0;

  if (validCreateRows.length > 0) {
    const animalsToInsert = validCreateRows.map(({ row }) => {
      const resolvedEarTagId = row.earTagId ?? earTagByNumber.get(row.earTagNumber?.toLowerCase() ?? "")?.id;
      return {
        farmId,
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

    const result = await appDrizzle.insert(tables.animals).values(animalsToInsert).returning({ id: tables.animals.id });
    created = result.length;
    result.forEach(({ id }, i) => {
      const earTagNumber = validCreateRows[i].row.earTagNumber;
      if (earTagNumber) importedEarTagToAnimalId.set(earTagNumber.toLowerCase(), id);
    });
  }

  const mergeRows = rows.flatMap((r, i) => (r.mergeAnimalId ? [{ row: r, index: i }] : []));
  let merged = 0;

  for (const { row, index } of mergeRows) {
    const animalId = row.mergeAnimalId!;
    let resolvedEarTagId: string | undefined;
    if (row.earTagId) {
      resolvedEarTagId = row.earTagId;
    } else if (row.earTagNumber) {
      const existing = earTagByNumber.get(row.earTagNumber.toLowerCase());
      if (existing) {
        if (existing.animal && existing.animal.id !== animalId) {
          skipped.push({ index, reason: `Ear tag already assigned: ${row.earTagNumber}` });
          continue;
        }
        resolvedEarTagId = existing.id;
      } else {
        const [newTag] = await appDrizzle
          .insert(tables.earTags)
          .values({ farmId, number: row.earTagNumber })
          .returning();
        resolvedEarTagId = newTag.id;
        earTagByNumber.set(row.earTagNumber.toLowerCase(), { ...newTag, animal: null });
      }
    }

    await appDrizzle
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

    if (row.earTagNumber) importedEarTagToAnimalId.set(row.earTagNumber.toLowerCase(), animalId);
    merged++;
  }

  // Resolve mother/father links from ear tag numbers
  const resolveParentId = (earTagNumber: string): string | undefined => {
    const tag = earTagByNumber.get(earTagNumber.toLowerCase());
    if (tag?.animal?.id) return tag.animal.id;
    return importedEarTagToAnimalId.get(earTagNumber.toLowerCase());
  };

  for (const row of rows) {
    if (!row.motherEarTagNumber && !row.fatherEarTagNumber) continue;
    const animalId =
      row.mergeAnimalId ??
      (row.earTagNumber ? importedEarTagToAnimalId.get(row.earTagNumber.toLowerCase()) : undefined);
    if (!animalId) continue;
    const motherId = row.motherEarTagNumber ? resolveParentId(row.motherEarTagNumber) : undefined;
    const fatherId = row.fatherEarTagNumber ? resolveParentId(row.fatherEarTagNumber) : undefined;
    if (!motherId && !fatherId) continue;
    await appDrizzle
      .update(tables.animals)
      .set({ ...(motherId ? { motherId } : {}), ...(fatherId ? { fatherId } : {}) })
      .where(eq(tables.animals.id, animalId));
  }

  return { created, merged, skipped };
}
