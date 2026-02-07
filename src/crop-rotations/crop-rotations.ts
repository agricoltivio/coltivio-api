import { addMonths, addWeeks, addYears, isWithinInterval } from "date-fns";
import { count, eq } from "drizzle-orm";
import { Crop } from "../crops/crops";
import { hasOverlappingRanges } from "../date-utils";
import { RlsDb } from "../db/db";
import {
  cropRotationRecurrences,
  cropRotations,
  farmIdColumnValue,
} from "../db/schema";

export enum RecurrenceFrequency {
  weekly = "weekly",
  monthly = "monthly",
  yearly = "yearly",
}

export enum RecurrenceWeekday {
  MO = "MO",
  TU = "TU",
  WE = "WE",
  TH = "TH",
  FR = "FR",
  SA = "SA",
  SU = "SU",
}

export type CropRotation = typeof cropRotations.$inferSelect & {
  crop: Crop;
};
export type CropRotationWithPlotName = CropRotation & {
  plot: { name: string };
};

export type CropRotationWithRecurrence = CropRotation & {
  recurrence?: typeof cropRotationRecurrences.$inferSelect | null;
};

export type CropRotationCreateInput = Omit<
  typeof cropRotations.$inferInsert,
  "id" | "farmId"
>;

export type CropRotationRecurrenceInput = Omit<
  typeof cropRotationRecurrences.$inferInsert,
  "id" | "cropRotationId" | "farmId"
>;

export type CropRotationByCropCreateManyInput = {
  cropId: string;
  plots: Array<
    CropRotationCreateInput & {
      recurrence?: CropRotationRecurrenceInput;
    }
  >;
};

export type CropRotationByPlotCreateManyInput = {
  plotId: string;
  crops: Array<{
    cropId: string;
    sowingDate?: Date;
    fromDate: Date;
    toDate: Date;
    recurrence?: CropRotationRecurrenceInput;
  }>;
};

export type CropRotationsPlanInput = {
  plots: Array<{
    plotId: string;
    crops: Array<{
      cropId: string;
      sowingDate?: Date;
      fromDate: Date;
      toDate: Date;
      recurrence?: CropRotationRecurrenceInput;
    }>;
  }>;
};

export type CropRotationUpdateInput = Partial<CropRotationCreateInput> & {
  recurrence?: CropRotationRecurrenceInput | null;
};

// Expands a crop rotation with recurrence into multiple entries based on the query date range
function expandRecurrence(
  rotation: CropRotationWithRecurrence,
  queryFromDate: Date,
  queryToDate: Date,
): CropRotation[] {
  if (!rotation.recurrence) {
    // No recurrence, return as-is if within range
    const rotationStart = rotation.fromDate;
    const rotationEnd = rotation.toDate;
    if (
      isWithinInterval(rotationStart, {
        start: queryFromDate,
        end: queryToDate,
      }) ||
      isWithinInterval(rotationEnd, { start: queryFromDate, end: queryToDate })
    ) {
      return [rotation];
    }
    return [];
  }

  const { frequency, interval, until, count: maxCount } = rotation.recurrence;
  const entries: CropRotation[] = [];

  // Calculate duration of the rotation (how many days it lasts)
  const durationMs = rotation.toDate.getTime() - rotation.fromDate.getTime();

  let currentDate = rotation.fromDate;
  let iterationCount = 0;

  while (true) {
    // Check if we've exceeded the recurrence limit
    if (until && currentDate > until) break;
    if (maxCount && iterationCount >= maxCount) break;

    // Calculate the end date for this occurrence
    const occurrenceEnd = new Date(currentDate.getTime() + durationMs);

    // Check if this occurrence is after the query range
    if (currentDate > queryToDate) break;

    // Only include if within the query range
    if (
      isWithinInterval(currentDate, {
        start: queryFromDate,
        end: queryToDate,
      }) ||
      isWithinInterval(occurrenceEnd, {
        start: queryFromDate,
        end: queryToDate,
      }) ||
      (currentDate <= queryFromDate && occurrenceEnd >= queryToDate)
    ) {
      entries.push({
        ...rotation,
        fromDate: currentDate,
        toDate: occurrenceEnd,
      });
    }

    // Move to next occurrence
    switch (frequency) {
      case "weekly":
        currentDate = addWeeks(currentDate, interval);
        break;
      case "monthly":
        currentDate = addMonths(currentDate, interval);
        break;
      case "yearly":
        currentDate = addYears(currentDate, interval);
        break;
    }

    iterationCount++;

    // Safety check to prevent infinite loops
    if (iterationCount > 1000) {
      console.warn("Recurrence expansion exceeded 1000 iterations, stopping");
      break;
    }
  }

  return entries;
}

// Helper to create a mock rotation for overlap checking
function createMockRotation(
  plotId: string,
  cropId: string,
  fromDate: Date,
  toDate: Date,
  sowingDate: Date | null | undefined,
  recurrence: CropRotationRecurrenceInput | null | undefined,
): CropRotationWithRecurrence {
  return {
    id: "",
    farmId: "",
    plotId,
    cropId,
    sowingDate: sowingDate ?? null,
    fromDate,
    toDate,
    crop: {
      id: cropId,
      farmId: "",
      name: "",
      category: "other" as const,
      familyId: null,
      variety: null,
      usageCodes: [],
      additionalNotes: null,
      waitingTimeInYears: null,
      family: null,
    },
    recurrence: recurrence
      ? {
          id: "",
          farmId: "",
          cropRotationId: "",
          frequency: recurrence.frequency,
          interval: recurrence.interval ?? 1,
          byWeekday: recurrence.byWeekday ?? null,
          byMonthDay: recurrence.byMonthDay ?? null,
          until: recurrence.until ?? null,
          count: recurrence.count ?? null,
        }
      : null,
  };
}

// Check for overlapping rotations considering recurrences
async function checkRotationOverlaps(
  tx: any,
  plotId: string,
  newRotations: Array<{
    cropId: string;
    fromDate: Date;
    toDate: Date;
    sowingDate?: Date | null;
    recurrence?: CropRotationRecurrenceInput | null;
  }>,
  excludeRotationId?: string,
): Promise<void> {
  // Fetch existing rotations with recurrences
  const whereClause = excludeRotationId
    ? { plotId, id: { ne: excludeRotationId } }
    : { plotId };

  const existingRotations = await tx.query.cropRotations.findMany({
    where: whereClause,
    with: { recurrence: true, crop: true },
    orderBy: { fromDate: "asc" },
  });

  // Use a reasonable time window for checking overlaps (100 years)
  const allDates = [
    ...newRotations.map((r: { fromDate: Date }) => r.fromDate.getTime()),
    ...existingRotations.map((r: CropRotationWithRecurrence) =>
      r.fromDate.getTime(),
    ),
  ];
  const checkFromDate = new Date(Math.min(...allDates));
  const checkToDate = addYears(checkFromDate, 100);

  // Expand existing rotations
  const expandedExisting = existingRotations.flatMap(
    (rotation: CropRotationWithRecurrence) =>
      expandRecurrence(rotation, checkFromDate, checkToDate),
  );

  // Create mock rotations for new entries and expand them
  const mockRotations = newRotations.map((rotation) =>
    createMockRotation(
      plotId,
      rotation.cropId,
      rotation.fromDate,
      rotation.toDate,
      rotation.sowingDate,
      rotation.recurrence,
    ),
  );

  const expandedNew = mockRotations.flatMap((rotation) =>
    expandRecurrence(rotation, checkFromDate, checkToDate),
  );

  const hasOverlap = hasOverlappingRanges([
    ...expandedExisting,
    ...expandedNew,
  ]);

  if (hasOverlap) {
    throw new Error("Overlapping date ranges");
  }
}

export function cropRotationsApi(rlsDb: RlsDb) {
  return {
    async getCropRotationsForPlot(
      plotId: string,
      fromDate: Date,
      toDate: Date,
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        const rotations = await tx.query.cropRotations.findMany({
          where: { plotId },
          with: {
            crop: {
              with: { family: true },
            },
            recurrence: true,
          },
        });

        // Expand recurrences
        const expanded = rotations.flatMap((rotation) =>
          expandRecurrence(rotation, fromDate, toDate),
        );

        return expanded;
      });
    },

    async getCropRotationsForPlots(
      plotIds: string[],
      onlyCurrent: boolean,
      fromDate: Date,
      toDate: Date,
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        const rotations = await tx.query.cropRotations.findMany({
          where: { plotId: { in: plotIds } },
          orderBy: { fromDate: "desc" },
          with: {
            crop: {
              with: { family: true },
            },
            recurrence: true,
          },
        });

        // Expand recurrences
        const expanded = rotations.flatMap((rotation) =>
          expandRecurrence(rotation, fromDate, toDate),
        );

        if (onlyCurrent) {
          // Group by plotId and get the current rotation for each plot
          const byPlot = new Map<string, CropRotation>();
          const now = new Date();
          for (const rotation of expanded) {
            if (rotation.fromDate <= now && rotation.toDate >= now) {
              byPlot.set(rotation.plotId, rotation);
            }
          }
          return Array.from(byPlot.values());
        }

        return expanded.sort(
          (a, b) => b.fromDate.getTime() - a.fromDate.getTime(),
        );
      });
    },
    async getCropRotationById(id: string): Promise<CropRotation | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropRotations.findFirst({
          where: { id },
          with: {
            crop: {
              with: { family: true },
            },
          },
        });
      });
    },

    async getCropRotationsForFarm(
      fromDate: Date,
      toDate: Date,
    ): Promise<CropRotationWithPlotName[]> {
      return rlsDb.rls(async (tx) => {
        // Fetch all rotations with recurrences
        const rotations = await tx.query.cropRotations.findMany({
          with: {
            crop: {
              with: { family: true },
            },
            plot: { columns: { name: true } },
            recurrence: true,
          },
        });

        // Expand recurrences and filter by date range
        const expanded = rotations.flatMap((rotation) =>
          expandRecurrence(rotation, fromDate, toDate).map((entry) => ({
            ...entry,
            plot: rotation.plot,
          })),
        );

        return expanded.sort(
          (a, b) => b.fromDate.getTime() - a.fromDate.getTime(),
        );
      });
    },
    async createCropRotation(
      input: CropRotationCreateInput & {
        recurrence?: CropRotationRecurrenceInput;
      },
    ): Promise<CropRotation> {
      const result = await rlsDb.rls(async (tx) => {
        const { recurrence, ...rotationInput } = input;

        const [plotCrop] = await tx
          .insert(cropRotations)
          .values({
            ...rotationInput,
            ...farmIdColumnValue,
          })
          .returning();

        // Create recurrence if provided
        if (recurrence) {
          await tx.insert(cropRotationRecurrences).values({
            cropRotationId: plotCrop.id,
            ...farmIdColumnValue,
            ...recurrence,
          });
        }

        return plotCrop;
      });
      const cropRotation = await this.getCropRotationById(result.id);
      return cropRotation!;
    },
    async createCropRotationsByPlot(
      input: CropRotationByPlotCreateManyInput,
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        if (input.crops.length === 0) {
          return [];
        }

        // Check for overlaps
        await checkRotationOverlaps(tx, input.plotId, input.crops);

        // Create the rotations
        const createdCropRotations = await tx
          .insert(cropRotations)
          .values(
            input.crops.map((plotRotation) => ({
              plotId: input.plotId,
              fromDate: plotRotation.fromDate,
              toDate: plotRotation.toDate,
              cropId: plotRotation.cropId,
              sowingDate: plotRotation.sowingDate,
              ...farmIdColumnValue,
            })),
          )
          .returning();

        // Create recurrences
        for (let i = 0; i < createdCropRotations.length; i++) {
          const recurrence = input.crops[i].recurrence;
          if (recurrence) {
            await tx.insert(cropRotationRecurrences).values({
              ...farmIdColumnValue,
              cropRotationId: createdCropRotations[i].id,
              ...recurrence,
            });
          }
        }

        return tx.query.cropRotations.findMany({
          where: {
            id: {
              in: createdCropRotations.map((cropRotation) => cropRotation.id),
            },
          },
          with: {
            crop: {
              with: { family: true },
            },
          },
        });
      });
    },

    async createCropRotationsByCrop(
      input: CropRotationByCropCreateManyInput,
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        if (input.plots.length === 0) {
          return [];
        }

        // Check for overlaps for each plot
        for (const plot of input.plots) {
          await checkRotationOverlaps(tx, plot.plotId, [
            {
              cropId: input.cropId,
              fromDate: plot.fromDate,
              toDate: plot.toDate,
              sowingDate: plot.sowingDate,
              recurrence: plot.recurrence,
            },
          ]);
        }

        const createdCropRotations = await tx
          .insert(cropRotations)
          .values(
            input.plots.map((plotRotation) => ({
              plotId: plotRotation.plotId,
              fromDate: plotRotation.fromDate,
              toDate: plotRotation.toDate,
              cropId: input.cropId,
              sowingDate: plotRotation.sowingDate,
              ...farmIdColumnValue,
            })),
          )
          .returning();

        // Create recurrences
        for (let i = 0; i < createdCropRotations.length; i++) {
          const recurrence = input.plots[i].recurrence;
          if (recurrence) {
            await tx.insert(cropRotationRecurrences).values({
              ...farmIdColumnValue,
              cropRotationId: createdCropRotations[i].id,
              ...recurrence,
            });
          }
        }

        return tx.query.cropRotations.findMany({
          where: {
            id: {
              in: createdCropRotations.map((cropRotation) => cropRotation.id),
            },
          },
          with: {
            crop: {
              with: { family: true },
            },
          },
        });
      });
    },

    async createCropRotationsPlan(
      input: CropRotationsPlanInput,
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        if (input.plots.length === 0) {
          return [];
        }

        // Validate each plot
        for (const plotPlan of input.plots) {
          await checkRotationOverlaps(tx, plotPlan.plotId, plotPlan.crops);
        }

        // Create all rotations
        const allRotationsToCreate = input.plots.flatMap((plotPlan) =>
          plotPlan.crops.map((crop) => ({
            plotId: plotPlan.plotId,
            fromDate: crop.fromDate,
            toDate: crop.toDate,
            cropId: crop.cropId,
            sowingDate: crop.sowingDate,
            ...farmIdColumnValue,
          })),
        );

        const createdCropRotations = await tx
          .insert(cropRotations)
          .values(allRotationsToCreate)
          .returning();

        // Create recurrences
        let rotationIndex = 0;
        for (const plotPlan of input.plots) {
          for (const crop of plotPlan.crops) {
            if (crop.recurrence) {
              await tx.insert(cropRotationRecurrences).values({
                ...farmIdColumnValue,
                cropRotationId: createdCropRotations[rotationIndex].id,
                ...crop.recurrence,
              });
            }
            rotationIndex++;
          }
        }

        return tx.query.cropRotations.findMany({
          where: {
            id: {
              in: createdCropRotations.map((rotation) => rotation.id),
            },
          },
          with: {
            crop: {
              with: { family: true },
            },
          },
        });
      });
    },

    async updateCropRotation(
      id: string,
      data: CropRotationUpdateInput,
    ): Promise<CropRotation> {
      const result = await rlsDb.rls(async (tx) => {
        const { recurrence, ...rotationData } = data;

        // Get the current rotation to know its plotId
        const currentRotation = await tx.query.cropRotations.findFirst({
          where: { id },
        });

        if (!currentRotation) {
          throw new Error("Crop rotation not found");
        }

        // Check for overlaps if dates or recurrence are being updated
        if (
          rotationData.fromDate ||
          rotationData.toDate ||
          recurrence !== undefined
        ) {
          await checkRotationOverlaps(
            tx,
            currentRotation.plotId,
            [
              {
                cropId: rotationData.cropId ?? currentRotation.cropId,
                fromDate: rotationData.fromDate ?? currentRotation.fromDate,
                toDate: rotationData.toDate ?? currentRotation.toDate,
                sowingDate:
                  rotationData.sowingDate ?? currentRotation.sowingDate,
                recurrence: recurrence,
              },
            ],
            id, // Exclude current rotation from overlap check
          );
        }

        // Update the rotation
        const [plotCrop] = await tx
          .update(cropRotations)
          .set(rotationData)
          .where(eq(cropRotations.id, id))
          .returning();

        // Handle recurrence updates
        if (recurrence !== undefined) {
          // Check if recurrence already exists
          const existingRecurrence =
            await tx.query.cropRotationRecurrences.findFirst({
              where: { cropRotationId: id },
            });

          if (recurrence === null) {
            // Delete existing recurrence if it exists
            if (existingRecurrence) {
              await tx
                .delete(cropRotationRecurrences)
                .where(eq(cropRotationRecurrences.cropRotationId, id));
            }
          } else {
            // Update or create recurrence
            if (existingRecurrence) {
              await tx
                .update(cropRotationRecurrences)
                .set(recurrence)
                .where(eq(cropRotationRecurrences.cropRotationId, id));
            } else {
              await tx.insert(cropRotationRecurrences).values({
                ...farmIdColumnValue,
                cropRotationId: id,
                ...recurrence,
              });
            }
          }
        }

        return plotCrop;
      });
      const cropRotation = await this.getCropRotationById(result.id);
      return cropRotation!;
    },

    async deleteCropRotation(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        const [countResult] = await tx
          .select({ count: count() })
          .from(cropRotations);
        if (countResult.count === 1) {
          throw new Error("Cannot delete last crop rotation");
        }
        await tx.delete(cropRotations).where(eq(cropRotations.id, id));
      });
    },

    async getCropRotationYears(): Promise<string[]> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.cropRotations.findMany({
          columns: {
            fromDate: true,
          },
          orderBy: { fromDate: "desc" },
        });
        return Array.from(
          new Set(
            result.map((rotation) =>
              rotation.fromDate.getFullYear().toString(),
            ),
          ),
        );
      });
    },
  };
}
