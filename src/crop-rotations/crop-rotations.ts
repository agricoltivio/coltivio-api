import { addYears, isWithinInterval } from "date-fns";
import { eq } from "drizzle-orm";
import { Crop } from "../crops/crops";
import { hasOverlappingRanges } from "../date-utils";
import { RlsDb } from "../db/db";
import {
  cropRotationYearlyRecurrences,
  cropRotations,
  farmIdColumnValue,
} from "../db/schema";

export type CropRotation = typeof cropRotations.$inferSelect & {
  crop: Crop;
};
export type CropRotationWithPlotName = CropRotation & {
  plot: { name: string };
};

export type CropRotationWithRecurrence = CropRotation & {
  recurrence: typeof cropRotationYearlyRecurrences.$inferSelect | null;
};

// Stricter type for API responses where recurrence is always defined (null or object)
export type CropRotationWithRecurrenceResult = CropRotation & {
  recurrence: Pick<
    typeof cropRotationYearlyRecurrences.$inferSelect,
    "id" | "interval" | "until"
  > | null;
};

export type CropRotationCreateInput = Omit<
  typeof cropRotations.$inferInsert,
  "id" | "farmId"
>;

export type CropRotationRecurrenceInput = Omit<
  typeof cropRotationYearlyRecurrences.$inferInsert,
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
    rotations: Array<{
      id?: string;
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
export function expandRecurrence(
  rotation: CropRotationWithRecurrence,
  queryFromDate: Date,
  queryToDate: Date,
): CropRotationWithRecurrenceResult[] {
  if (!rotation.recurrence) {
    // No recurrence, return as-is if within range
    const rotationStart = rotation.fromDate;
    const rotationEnd = rotation.toDate;
    if (
      isWithinInterval(rotationStart, {
        start: queryFromDate,
        end: queryToDate,
      }) ||
      isWithinInterval(rotationEnd, {
        start: queryFromDate,
        end: queryToDate,
      }) ||
      (rotationStart <= queryFromDate && rotationEnd >= queryToDate)
    ) {
      return [rotation];
    }
    return [];
  }

  const { until, interval } = rotation.recurrence;
  const entries: CropRotationWithRecurrence[] = [];

  // Calculate duration of the rotation (how many days it lasts)
  const durationMs = rotation.toDate.getTime() - rotation.fromDate.getTime();

  let currentDate = rotation.fromDate;
  let iterationCount = 0;

  while (true) {
    // Check if we've exceeded the recurrence limit
    if (until && currentDate > until) break;

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

    currentDate = addYears(currentDate, interval);

    iterationCount++;

    // Safety check to prevent infinite loops
    if (iterationCount > 1000) {
      console.warn("Recurrence expansion exceeded 1000 iterations, stopping");
      break;
    }
  }

  return entries;
}

export type DateRangeWithRecurrence = {
  fromDate: Date;
  toDate: Date;
  recurrence?: { interval: number; until: Date | null } | null;
};

const MS_PER_DAY = 86400000;

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / MS_PER_DAY);
}

// Year-crossing ranges (fromDay > toDay, e.g. Nov–Mar) are split into two
// sub-ranges so we don't produce false positives against non-overlapping windows.
function dayRangesOverlap(
  aFromDay: number,
  aToDay: number,
  bFromDay: number,
  bToDay: number,
): boolean {
  const aRanges: [number, number][] = aFromDay <= aToDay ? [[aFromDay, aToDay]] : [[aFromDay, 366], [1, aToDay]];
  const bRanges: [number, number][] = bFromDay <= bToDay ? [[bFromDay, bToDay]] : [[bFromDay, 366], [1, bToDay]];
  return aRanges.some(([af, at]) => bRanges.some(([bf, bt]) => af <= bt && at >= bf));
}

// Enumerate all years a recurring rotation occurs in, within a bounded range
// yearSpan accounts for year-crossing occurrences (e.g. Nov–Mar has yearSpan=1)
// so each slot covers year through year+yearSpan in the set.
function getOccurrenceYears(
  startYear: number,
  interval: number,
  untilYear: number | null,
  rangeStart: number,
  rangeEnd: number,
  yearSpan: number,
): Set<number> {
  const years = new Set<number>();
  const effectiveEnd =
    untilYear !== null ? Math.min(untilYear, rangeEnd) : rangeEnd;
  for (let year = startYear; year <= effectiveEnd; year += interval) {
    for (let span = 0; span <= yearSpan; span++) {
      if (year + span >= rangeStart) years.add(year + span);
    }
  }
  return years;
}

// Check if two date ranges overlap considering yearly recurrences.
// For recurrences: check day-of-year overlap AND that they share a common occurrence year.
function rangesOverlap(
  a: DateRangeWithRecurrence,
  b: DateRangeWithRecurrence,
): boolean {
  const aHasRecurrence = !!a.recurrence;
  const bHasRecurrence = !!b.recurrence;

  if (!aHasRecurrence && !bHasRecurrence) {
    return a.fromDate <= b.toDate && b.fromDate <= a.toDate;
  }

  // At least one has recurrence — check day-of-year overlap
  const aFromDay = getDayOfYear(a.fromDate);
  const aToDay = getDayOfYear(a.toDate);
  const bFromDay = getDayOfYear(b.fromDate);
  const bToDay = getDayOfYear(b.toDate);

  if (!dayRangesOverlap(aFromDay, aToDay, bFromDay, bToDay)) {
    return false;
  }

  // Check if they share a common occurrence year.
  // yearSpan covers year-crossing ranges (e.g. Nov–Mar → yearSpan=1) so the
  // second calendar year each occurrence occupies is included in the set.
  const aStartYear = a.fromDate.getFullYear();
  const bStartYear = b.fromDate.getFullYear();
  const aYearSpan = a.toDate.getFullYear() - a.fromDate.getFullYear();
  const bYearSpan = b.toDate.getFullYear() - b.fromDate.getFullYear();
  const aInterval = a.recurrence?.interval ?? 1;
  const bInterval = b.recurrence?.interval ?? 1;
  const aUntilYear = a.recurrence?.until?.getFullYear() ?? null;
  const bUntilYear = b.recurrence?.until?.getFullYear() ?? null;

  // Derive a bounded range from the actual dates (deterministic, no dependency on current time)
  const rangeStart = Math.min(aStartYear, bStartYear);
  const maxUntil = Math.max(
    aUntilYear ?? aStartYear + 100,
    bUntilYear ?? bStartYear + 100,
  );
  const rangeEnd = Math.min(maxUntil, rangeStart + 200);

  const aYears = aHasRecurrence
    ? getOccurrenceYears(aStartYear, aInterval, aUntilYear, rangeStart, rangeEnd, aYearSpan)
    : new Set(Array.from({ length: aYearSpan + 1 }, (_, i) => aStartYear + i));
  const bYears = bHasRecurrence
    ? getOccurrenceYears(bStartYear, bInterval, bUntilYear, rangeStart, rangeEnd, bYearSpan)
    : new Set(Array.from({ length: bYearSpan + 1 }, (_, i) => bStartYear + i));

  for (const year of aYears) {
    if (bYears.has(year)) return true;
  }
  return false;
}

// Check for overlapping rotations - pure function taking date ranges
export function checkRotationOverlaps(
  existingRanges: DateRangeWithRecurrence[],
  newRanges: DateRangeWithRecurrence[],
): void {
  const allRanges = [...existingRanges, ...newRanges];

  for (let i = 0; i < allRanges.length; i++) {
    for (let j = i + 1; j < allRanges.length; j++) {
      if (rangesOverlap(allRanges[i], allRanges[j])) {
        throw new Error("Overlapping date ranges");
      }
    }
  }
}

export function cropRotationsApi(rlsDb: RlsDb) {
  return {
    async getCropRotationsForPlot(
      plotId: string,
      fromDate: Date,
      toDate: Date,
    ): Promise<CropRotationWithRecurrenceResult[]> {
      return rlsDb.rls(async (tx) => {
        const rotations = await tx.query.cropRotations.findMany({
          where: {
            plotId,
          },
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
      options: { expand?: boolean; withRecurrences?: boolean } = {},
    ): Promise<CropRotationWithRecurrenceResult[]> {
      const { expand = true, withRecurrences = false } = options;

      return rlsDb.rls(async (tx) => {
        const rotations = await tx.query.cropRotations.findMany({
          where: {
            plotId: { in: plotIds },
          },
          orderBy: { fromDate: "desc" },
          with: {
            crop: {
              with: { family: true },
            },
            recurrence: true,
          },
        });

        // Optionally expand recurrences
        const processed = expand
          ? rotations.flatMap((rotation) =>
              expandRecurrence(rotation, fromDate, toDate),
            )
          : rotations;

        // Map to result type, stripping recurrence unless requested
        const result: CropRotationWithRecurrenceResult[] = processed.map(
          (r) => ({
            ...r,
            recurrence:
              withRecurrences && r.recurrence
                ? {
                    id: r.recurrence.id,
                    interval: r.recurrence.interval,
                    until: r.recurrence.until,
                  }
                : null,
          }),
        );

        if (onlyCurrent) {
          // Group by plotId and get the current rotation for each plot
          const byPlot = new Map<string, CropRotationWithRecurrenceResult>();
          const now = new Date();
          for (const rotation of result) {
            if (rotation.fromDate <= now && rotation.toDate >= now) {
              byPlot.set(rotation.plotId, rotation);
            }
          }
          return Array.from(byPlot.values());
        }

        return result.sort(
          (a, b) => b.fromDate.getTime() - a.fromDate.getTime(),
        );
      });
    },
    async getCropRotationById(
      id: string,
    ): Promise<CropRotationWithRecurrenceResult | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropRotations.findFirst({
          where: { id },
          with: {
            crop: {
              with: { family: true },
            },
            recurrence: true,
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
          await tx.insert(cropRotationYearlyRecurrences).values({
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

        // Fetch existing rotations for overlap check
        const existingRotations = await tx.query.cropRotations.findMany({
          where: { plotId: input.plotId },
          with: { recurrence: true },
        });
        const existingRanges: DateRangeWithRecurrence[] = existingRotations.map(
          (r) => ({
            fromDate: r.fromDate,
            toDate: r.toDate,
            recurrence: r.recurrence,
          }),
        );
        const newRanges: DateRangeWithRecurrence[] = input.crops.map((c) => ({
          fromDate: c.fromDate,
          toDate: c.toDate,
          recurrence: c.recurrence
            ? {
                interval: c.recurrence.interval ?? 1,
                until: c.recurrence.until ?? null,
              }
            : null,
        }));
        checkRotationOverlaps(existingRanges, newRanges);

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
            await tx.insert(cropRotationYearlyRecurrences).values({
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
          const existingRotations = await tx.query.cropRotations.findMany({
            where: { plotId: plot.plotId },
            with: { recurrence: true },
          });
          const existingRanges: DateRangeWithRecurrence[] =
            existingRotations.map((r) => ({
              fromDate: r.fromDate,
              toDate: r.toDate,
              recurrence: r.recurrence,
            }));
          const newRange: DateRangeWithRecurrence = {
            fromDate: plot.fromDate,
            toDate: plot.toDate,
            recurrence: plot.recurrence
              ? {
                  interval: plot.recurrence.interval ?? 1,
                  until: plot.recurrence.until ?? null,
                }
              : null,
          };
          checkRotationOverlaps(existingRanges, [newRange]);
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
            await tx.insert(cropRotationYearlyRecurrences).values({
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

    async planCropRotations(
      input: CropRotationsPlanInput,
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        if (input.plots.length === 0) {
          return [];
        }

        const resultIds: string[] = [];

        for (const plotPlan of input.plots) {
          // Separate rotations into updates (has id) and creates (no id)
          const toUpdate = plotPlan.rotations.filter((r) => r.id);
          const toCreate = plotPlan.rotations.filter((r) => !r.id);

          // Fetch existing rotations for this plot, excluding ones we're updating
          const updateIds = toUpdate.map((r) => r.id!);
          const existingRotations = await tx.query.cropRotations.findMany({
            where: { plotId: plotPlan.plotId },
            with: { recurrence: true },
          });

          // Build ranges for overlap check: existing (excluding updates) + updates + creates
          const existingRanges: DateRangeWithRecurrence[] = existingRotations
            .filter((r) => !updateIds.includes(r.id))
            .map((r) => ({
              fromDate: r.fromDate,
              toDate: r.toDate,
              recurrence: r.recurrence,
            }));

          const allNewRanges: DateRangeWithRecurrence[] = [
            ...toUpdate.map((r) => ({
              fromDate: r.fromDate,
              toDate: r.toDate,
              recurrence: r.recurrence
                ? {
                    interval: r.recurrence.interval ?? 1,
                    until: r.recurrence.until ?? null,
                  }
                : null,
            })),
            ...toCreate.map((r) => ({
              fromDate: r.fromDate,
              toDate: r.toDate,
              recurrence: r.recurrence
                ? {
                    interval: r.recurrence.interval ?? 1,
                    until: r.recurrence.until ?? null,
                  }
                : null,
            })),
          ];

          checkRotationOverlaps(existingRanges, allNewRanges);

          // Process updates
          for (const rotation of toUpdate) {
            await tx
              .update(cropRotations)
              .set({
                cropId: rotation.cropId,
                fromDate: rotation.fromDate,
                toDate: rotation.toDate,
                sowingDate: rotation.sowingDate,
              })
              .where(eq(cropRotations.id, rotation.id!));

            // Handle recurrence: delete existing and recreate if provided
            await tx
              .delete(cropRotationYearlyRecurrences)
              .where(
                eq(cropRotationYearlyRecurrences.cropRotationId, rotation.id!),
              );

            if (rotation.recurrence) {
              await tx.insert(cropRotationYearlyRecurrences).values({
                ...farmIdColumnValue,
                cropRotationId: rotation.id!,
                ...rotation.recurrence,
              });
            }

            resultIds.push(rotation.id!);
          }

          // Process creates
          if (toCreate.length > 0) {
            const created = await tx
              .insert(cropRotations)
              .values(
                toCreate.map((r) => ({
                  plotId: plotPlan.plotId,
                  cropId: r.cropId,
                  fromDate: r.fromDate,
                  toDate: r.toDate,
                  sowingDate: r.sowingDate,
                  ...farmIdColumnValue,
                })),
              )
              .returning();

            for (let i = 0; i < created.length; i++) {
              if (toCreate[i].recurrence) {
                await tx.insert(cropRotationYearlyRecurrences).values({
                  ...farmIdColumnValue,
                  cropRotationId: created[i].id,
                  ...toCreate[i].recurrence,
                });
              }
              resultIds.push(created[i].id);
            }
          }
        }

        return tx.query.cropRotations.findMany({
          where: {
            id: { in: resultIds },
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
          with: { recurrence: true },
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
          // Fetch other rotations for this plot (excluding current)
          const existingRotations = await tx.query.cropRotations.findMany({
            where: { plotId: currentRotation.plotId },
            with: { recurrence: true },
          });
          const existingRanges: DateRangeWithRecurrence[] = existingRotations
            .filter((r) => r.id !== id)
            .map((r) => ({
              fromDate: r.fromDate,
              toDate: r.toDate,
              recurrence: r.recurrence,
            }));

          const updatedRange: DateRangeWithRecurrence = {
            fromDate: rotationData.fromDate ?? currentRotation.fromDate,
            toDate: rotationData.toDate ?? currentRotation.toDate,
            recurrence:
              recurrence !== undefined
                ? recurrence
                  ? {
                      interval: recurrence.interval ?? 1,
                      until: recurrence.until ?? null,
                    }
                  : null
                : currentRotation.recurrence,
          };

          checkRotationOverlaps(existingRanges, [updatedRange]);
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
                .delete(cropRotationYearlyRecurrences)
                .where(eq(cropRotationYearlyRecurrences.cropRotationId, id));
            }
          } else {
            // Update or create recurrence
            if (existingRecurrence) {
              await tx
                .update(cropRotationYearlyRecurrences)
                .set(recurrence)
                .where(eq(cropRotationYearlyRecurrences.cropRotationId, id));
            } else {
              await tx.insert(cropRotationYearlyRecurrences).values({
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
