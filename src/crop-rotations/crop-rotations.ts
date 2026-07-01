import { addYears, isWithinInterval } from "date-fns";
import { eq } from "drizzle-orm";
import { Crop } from "../crops/crops";
import { appDrizzle } from "../db/db";
import { cropRotationYearlyRecurrences, cropRotations } from "../db/schema";

export type CropRotation = typeof cropRotations.$inferSelect & {
  crop: Crop;
};
export type CropRotationWithPlotName = CropRotation & {
  plot: { name: string };
};

export type CropRotationWithRecurrence = CropRotation & {
  recurrence: typeof cropRotationYearlyRecurrences.$inferSelect | null;
};

export type CropRotationWithRecurrenceResult = CropRotation & {
  recurrence: Pick<typeof cropRotationYearlyRecurrences.$inferSelect, "id" | "interval" | "until"> | null;
};

export type CropRotationCreateInput = Omit<typeof cropRotations.$inferInsert, "id" | "farmId">;

export type CropRotationRecurrenceInput = Omit<
  typeof cropRotationYearlyRecurrences.$inferInsert,
  "id" | "cropRotationId" | "farmId"
>;

export type CropRotationByCropCreateManyInput = {
  cropId: string;
  plots: Array<CropRotationCreateInput & { recurrence?: CropRotationRecurrenceInput }>;
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

export function expandRecurrence(
  rotation: CropRotationWithRecurrence,
  queryFromDate: Date,
  queryToDate: Date
): CropRotationWithRecurrenceResult[] {
  if (!rotation.recurrence) {
    const rotationStart = rotation.fromDate;
    const rotationEnd = rotation.toDate;
    if (
      isWithinInterval(rotationStart, { start: queryFromDate, end: queryToDate }) ||
      isWithinInterval(rotationEnd, { start: queryFromDate, end: queryToDate }) ||
      (rotationStart <= queryFromDate && rotationEnd >= queryToDate)
    ) {
      return [rotation];
    }
    return [];
  }

  const { until, interval } = rotation.recurrence;
  const entries: CropRotationWithRecurrence[] = [];
  const durationMs = rotation.toDate.getTime() - rotation.fromDate.getTime();
  let currentDate = rotation.fromDate;
  let iterationCount = 0;

  while (true) {
    if (until && currentDate > until) break;
    const occurrenceEnd = new Date(currentDate.getTime() + durationMs);
    if (currentDate > queryToDate) break;
    if (
      isWithinInterval(currentDate, { start: queryFromDate, end: queryToDate }) ||
      isWithinInterval(occurrenceEnd, { start: queryFromDate, end: queryToDate }) ||
      (currentDate <= queryFromDate && occurrenceEnd >= queryToDate)
    ) {
      entries.push({ ...rotation, fromDate: currentDate, toDate: occurrenceEnd });
    }
    currentDate = addYears(currentDate, interval);
    iterationCount++;
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

function expandOccurrences(range: DateRangeWithRecurrence, queryFrom: Date, queryTo: Date): [Date, Date][] {
  if (!range.recurrence) return [[range.fromDate, range.toDate]];
  const { interval, until } = range.recurrence;
  const durationMs = range.toDate.getTime() - range.fromDate.getTime();
  const occurrences: [Date, Date][] = [];
  let current = range.fromDate;
  let iter = 0;
  while (iter < 1000) {
    if (until && current > until) break;
    if (current > queryTo) break;
    const end = new Date(current.getTime() + durationMs);
    if (end >= queryFrom) occurrences.push([current, end]);
    current = addYears(current, interval);
    iter++;
  }
  return occurrences;
}

function rangesOverlap(a: DateRangeWithRecurrence, b: DateRangeWithRecurrence): boolean {
  if (!a.recurrence && !b.recurrence) return a.fromDate <= b.toDate && b.fromDate <= a.toDate;
  const rangeStart = new Date(Math.min(a.fromDate.getFullYear(), b.fromDate.getFullYear()), 0, 1);
  const aUntilYear = a.recurrence?.until?.getFullYear() ?? null;
  const bUntilYear = b.recurrence?.until?.getFullYear() ?? null;
  const maxUntilYear = Math.max(
    aUntilYear ?? a.fromDate.getFullYear() + 100,
    bUntilYear ?? b.fromDate.getFullYear() + 100
  );
  const rangeEndYear = Math.min(maxUntilYear, rangeStart.getFullYear() + 200);
  const rangeEnd = new Date(rangeEndYear + 1, 0, 1);
  const aOccurrences = expandOccurrences(a, rangeStart, rangeEnd);
  const bOccurrences = expandOccurrences(b, rangeStart, rangeEnd);
  return aOccurrences.some(([af, at]) => bOccurrences.some(([bf, bt]) => af <= bt && at >= bf));
}

export function checkRotationOverlaps(ranges: DateRangeWithRecurrence[]): void {
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) throw new Error("Overlapping date ranges");
    }
  }
}

export async function getCropRotationsForPlot(
  plotId: string,
  fromDate: Date,
  toDate: Date
): Promise<CropRotationWithRecurrenceResult[]> {
  const rotations = await appDrizzle.query.cropRotations.findMany({
    where: { plotId },
    with: { crop: { with: { family: true } }, recurrence: true },
  });
  return rotations.flatMap((rotation) => expandRecurrence(rotation, fromDate, toDate));
}

export async function getCropRotationsForPlots(
  plotIds: string[],
  onlyCurrent: boolean,
  fromDate: Date,
  toDate: Date,
  options: { expand?: boolean; withRecurrences?: boolean } = {}
): Promise<CropRotationWithRecurrenceResult[]> {
  const { expand = true, withRecurrences = false } = options;
  const rotations = await appDrizzle.query.cropRotations.findMany({
    where: { plotId: { in: plotIds } },
    orderBy: { fromDate: "desc" },
    with: { crop: { with: { family: true } }, recurrence: true },
  });
  const processed = expand ? rotations.flatMap((rotation) => expandRecurrence(rotation, fromDate, toDate)) : rotations;
  const result: CropRotationWithRecurrenceResult[] = processed.map((r) => ({
    ...r,
    recurrence:
      withRecurrences && r.recurrence
        ? { id: r.recurrence.id, interval: r.recurrence.interval, until: r.recurrence.until }
        : null,
  }));
  if (onlyCurrent) {
    const byPlot = new Map<string, CropRotationWithRecurrenceResult>();
    const now = new Date();
    for (const rotation of result) {
      if (rotation.fromDate <= now && rotation.toDate >= now) byPlot.set(rotation.plotId, rotation);
    }
    return Array.from(byPlot.values());
  }
  return result.sort((a, b) => b.fromDate.getTime() - a.fromDate.getTime());
}

export async function getCropRotationById(id: string): Promise<CropRotationWithRecurrenceResult | undefined> {
  return appDrizzle.query.cropRotations.findFirst({
    where: { id },
    with: { crop: { with: { family: true } }, recurrence: true },
  });
}

export async function getCropRotationsForFarm(
  farmId: string,
  fromDate: Date,
  toDate: Date,
  options: { expand?: boolean; withRecurrences?: boolean } = {}
): Promise<(CropRotationWithRecurrenceResult & { plot: { name: string } })[]> {
  const { expand = true, withRecurrences = false } = options;
  const rotations = await appDrizzle.query.cropRotations.findMany({
    where: { farmId },
    with: { crop: { with: { family: true } }, plot: { columns: { name: true } }, recurrence: true },
  });
  const processed = expand
    ? rotations.flatMap((rotation) =>
        expandRecurrence(rotation, fromDate, toDate).map((entry) => ({ ...entry, plot: rotation.plot }))
      )
    : rotations.map((rotation) => ({ ...rotation, plot: rotation.plot }));
  const result = processed.map((r) => ({
    ...r,
    recurrence:
      withRecurrences && r.recurrence
        ? { id: r.recurrence.id, interval: r.recurrence.interval, until: r.recurrence.until }
        : null,
  }));
  return result.sort((a, b) => b.fromDate.getTime() - a.fromDate.getTime());
}

export async function createCropRotation(
  input: CropRotationCreateInput & { recurrence?: CropRotationRecurrenceInput },
  farmId: string
): Promise<CropRotation> {
  const result = await appDrizzle.transaction(async (tx) => {
    const { recurrence, ...rotationInput } = input;
    const [plotCrop] = await tx
      .insert(cropRotations)
      .values({ ...rotationInput, farmId })
      .returning();
    if (recurrence) {
      await tx.insert(cropRotationYearlyRecurrences).values({ cropRotationId: plotCrop.id, farmId, ...recurrence });
    }
    return plotCrop;
  });
  const cropRotation = await getCropRotationById(result.id);
  return cropRotation!;
}

export async function createCropRotationsByPlot(
  input: CropRotationByPlotCreateManyInput,
  farmId: string
): Promise<CropRotation[]> {
  return appDrizzle.transaction(async (tx) => {
    if (input.crops.length === 0) return [];
    const existingRotations = await tx.query.cropRotations.findMany({
      where: { plotId: input.plotId },
      with: { recurrence: true },
    });
    const existingRanges: DateRangeWithRecurrence[] = existingRotations.map((r) => ({
      fromDate: r.fromDate,
      toDate: r.toDate,
      recurrence: r.recurrence,
    }));
    const newRanges: DateRangeWithRecurrence[] = input.crops.map((c) => ({
      fromDate: c.fromDate,
      toDate: c.toDate,
      recurrence: c.recurrence ? { interval: c.recurrence.interval ?? 1, until: c.recurrence.until ?? null } : null,
    }));
    checkRotationOverlaps([...existingRanges, ...newRanges]);

    const createdCropRotations = await tx
      .insert(cropRotations)
      .values(
        input.crops.map((plotRotation) => ({
          plotId: input.plotId,
          fromDate: plotRotation.fromDate,
          toDate: plotRotation.toDate,
          cropId: plotRotation.cropId,
          sowingDate: plotRotation.sowingDate,
          farmId,
        }))
      )
      .returning();

    for (let i = 0; i < createdCropRotations.length; i++) {
      const recurrence = input.crops[i].recurrence;
      if (recurrence)
        await tx
          .insert(cropRotationYearlyRecurrences)
          .values({ farmId, cropRotationId: createdCropRotations[i].id, ...recurrence });
    }

    return tx.query.cropRotations.findMany({
      where: { id: { in: createdCropRotations.map((r) => r.id) } },
      with: { crop: { with: { family: true } } },
    });
  });
}

export async function createCropRotationsByCrop(
  input: CropRotationByCropCreateManyInput,
  farmId: string
): Promise<CropRotation[]> {
  return appDrizzle.transaction(async (tx) => {
    if (input.plots.length === 0) return [];
    for (const plot of input.plots) {
      const existingRotations = await tx.query.cropRotations.findMany({
        where: { plotId: plot.plotId },
        with: { recurrence: true },
      });
      const existingRanges: DateRangeWithRecurrence[] = existingRotations.map((r) => ({
        fromDate: r.fromDate,
        toDate: r.toDate,
        recurrence: r.recurrence,
      }));
      const newRange: DateRangeWithRecurrence = {
        fromDate: plot.fromDate,
        toDate: plot.toDate,
        recurrence: plot.recurrence
          ? { interval: plot.recurrence.interval ?? 1, until: plot.recurrence.until ?? null }
          : null,
      };
      checkRotationOverlaps([...existingRanges, newRange]);
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
          farmId,
        }))
      )
      .returning();

    for (let i = 0; i < createdCropRotations.length; i++) {
      const recurrence = input.plots[i].recurrence;
      if (recurrence)
        await tx
          .insert(cropRotationYearlyRecurrences)
          .values({ farmId, cropRotationId: createdCropRotations[i].id, ...recurrence });
    }

    return tx.query.cropRotations.findMany({
      where: { id: { in: createdCropRotations.map((r) => r.id) } },
      with: { crop: { with: { family: true } } },
    });
  });
}

export async function planCropRotations(input: CropRotationsPlanInput, farmId: string): Promise<CropRotation[]> {
  return appDrizzle.transaction(async (tx) => {
    if (input.plots.length === 0) return [];
    const resultIds: string[] = [];
    for (const plotPlan of input.plots) {
      const newRanges: DateRangeWithRecurrence[] = plotPlan.rotations.map((r) => ({
        fromDate: r.fromDate,
        toDate: r.toDate,
        recurrence: r.recurrence ? { interval: r.recurrence.interval ?? 1, until: r.recurrence.until ?? null } : null,
      }));
      checkRotationOverlaps(newRanges);
      await tx.delete(cropRotations).where(eq(cropRotations.plotId, plotPlan.plotId));
      if (plotPlan.rotations.length === 0) continue;
      const created = await tx
        .insert(cropRotations)
        .values(
          plotPlan.rotations.map((r) => ({
            plotId: plotPlan.plotId,
            cropId: r.cropId,
            fromDate: r.fromDate,
            toDate: r.toDate,
            sowingDate: r.sowingDate,
            farmId,
          }))
        )
        .returning();
      for (let i = 0; i < created.length; i++) {
        if (plotPlan.rotations[i].recurrence) {
          await tx
            .insert(cropRotationYearlyRecurrences)
            .values({ farmId, cropRotationId: created[i].id, ...plotPlan.rotations[i].recurrence });
        }
        resultIds.push(created[i].id);
      }
    }
    return tx.query.cropRotations.findMany({
      where: { id: { in: resultIds } },
      with: { crop: { with: { family: true } } },
    });
  });
}

export async function updateCropRotation(
  id: string,
  data: CropRotationUpdateInput,
  farmId: string
): Promise<CropRotation> {
  const result = await appDrizzle.transaction(async (tx) => {
    const { recurrence, ...rotationData } = data;
    const currentRotation = await tx.query.cropRotations.findFirst({ where: { id }, with: { recurrence: true } });
    if (!currentRotation) throw new Error("Crop rotation not found");

    if (rotationData.fromDate || rotationData.toDate || recurrence !== undefined) {
      const existingRotations = await tx.query.cropRotations.findMany({
        where: { plotId: currentRotation.plotId },
        with: { recurrence: true },
      });
      const existingRanges: DateRangeWithRecurrence[] = existingRotations
        .filter((r) => r.id !== id)
        .map((r) => ({ fromDate: r.fromDate, toDate: r.toDate, recurrence: r.recurrence }));
      const updatedRange: DateRangeWithRecurrence = {
        fromDate: rotationData.fromDate ?? currentRotation.fromDate,
        toDate: rotationData.toDate ?? currentRotation.toDate,
        recurrence:
          recurrence !== undefined
            ? recurrence
              ? { interval: recurrence.interval ?? 1, until: recurrence.until ?? null }
              : null
            : currentRotation.recurrence,
      };
      checkRotationOverlaps([...existingRanges, updatedRange]);
    }

    const [plotCrop] = await tx.update(cropRotations).set(rotationData).where(eq(cropRotations.id, id)).returning();

    if (recurrence !== undefined) {
      const existingRecurrence = await tx.query.cropRotationRecurrences.findFirst({ where: { cropRotationId: id } });
      if (recurrence === null) {
        if (existingRecurrence)
          await tx.delete(cropRotationYearlyRecurrences).where(eq(cropRotationYearlyRecurrences.cropRotationId, id));
      } else {
        if (existingRecurrence) {
          await tx
            .update(cropRotationYearlyRecurrences)
            .set(recurrence)
            .where(eq(cropRotationYearlyRecurrences.cropRotationId, id));
        } else {
          await tx.insert(cropRotationYearlyRecurrences).values({ farmId, cropRotationId: id, ...recurrence });
        }
      }
    }

    return plotCrop;
  });
  const cropRotation = await getCropRotationById(result.id);
  return cropRotation!;
}

export async function deleteCropRotation(id: string): Promise<void> {
  await appDrizzle.delete(cropRotations).where(eq(cropRotations.id, id));
}

export async function getCropRotationYears(farmId: string): Promise<string[]> {
  const result = await appDrizzle.query.cropRotations.findMany({
    where: { farmId },
    columns: { fromDate: true },
    orderBy: { fromDate: "desc" },
  });
  return Array.from(new Set(result.map((rotation) => rotation.fromDate.getFullYear().toString())));
}
