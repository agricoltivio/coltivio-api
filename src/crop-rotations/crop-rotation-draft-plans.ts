import { eq } from "drizzle-orm";
import { Crop } from "../crops/crops";
import { appDrizzle } from "../db/db";
import { cropRotationDraftPlanEntries, cropRotationDraftPlanPlots, cropRotationDraftPlans } from "../db/schema";
import { CropRotationsPlanInput, CropRotationWithRecurrenceResult } from "./crop-rotations";

export type DraftPlan = typeof cropRotationDraftPlans.$inferSelect;

type DraftPlanEntry = Omit<typeof cropRotationDraftPlanEntries.$inferSelect, "draftPlanPlotId" | "farmId"> & {
  crop: Crop;
};

export type DraftPlanPlot = Omit<typeof cropRotationDraftPlanPlots.$inferSelect, "farmId" | "draftPlanId"> & {
  rotations: CropRotationWithRecurrenceResult[];
};

export type DraftPlanWithPlots = DraftPlan & {
  plots: DraftPlanPlot[];
};

type RotationInput = {
  cropId: string;
  sowingDate?: Date;
  fromDate: Date;
  toDate: Date;
  recurrenceInterval?: number;
  recurrenceUntil?: Date;
};

type PlotInput = {
  plotId: string;
  rotations: RotationInput[];
};

function mapEntryToRotation(entry: DraftPlanEntry): CropRotationWithRecurrenceResult {
  return {
    id: entry.id,
    farmId: "",
    plotId: "",
    cropId: entry.cropId,
    sowingDate: entry.sowingDate,
    fromDate: entry.fromDate,
    toDate: entry.toDate,
    crop: entry.crop,
    recurrence:
      entry.recurrenceInterval != null
        ? {
            id: entry.id,
            interval: entry.recurrenceInterval,
            until: entry.recurrenceUntil ?? null,
          }
        : null,
  };
}

type RawPlan = typeof cropRotationDraftPlans.$inferSelect & {
  plots: Array<
    typeof cropRotationDraftPlanPlots.$inferSelect & {
      entries: Array<typeof cropRotationDraftPlanEntries.$inferSelect & { crop: Crop }>;
    }
  >;
};

function mapPlanResult(plan: RawPlan): DraftPlanWithPlots {
  return {
    ...plan,
    plots: plan.plots.map((p) => ({
      id: p.id,
      plotId: p.plotId,
      rotations: p.entries.map(mapEntryToRotation),
    })),
  };
}

export async function createDraftPlan(name: string, plots: PlotInput[], farmId: string): Promise<DraftPlanWithPlots> {
  return appDrizzle.transaction(async (tx) => {
    const [plan] = await tx.insert(cropRotationDraftPlans).values({ farmId, name }).returning();

    for (const plotInput of plots) {
      const [plotRow] = await tx
        .insert(cropRotationDraftPlanPlots)
        .values({ farmId, draftPlanId: plan.id, plotId: plotInput.plotId })
        .returning();

      if (plotInput.rotations.length > 0) {
        await tx.insert(cropRotationDraftPlanEntries).values(
          plotInput.rotations.map((r) => ({
            farmId,
            draftPlanPlotId: plotRow.id,
            cropId: r.cropId,
            sowingDate: r.sowingDate ?? null,
            fromDate: r.fromDate,
            toDate: r.toDate,
            recurrenceInterval: r.recurrenceInterval ?? null,
            recurrenceUntil: r.recurrenceUntil ?? null,
          }))
        );
      }
    }

    const full = await tx.query.cropRotationDraftPlans.findFirst({
      where: { id: plan.id },
      with: { plots: { with: { entries: { with: { crop: { with: { family: true } } } } } } },
    });

    return mapPlanResult(full!);
  });
}

export async function listDraftPlans(farmId: string): Promise<DraftPlan[]> {
  return appDrizzle.query.cropRotationDraftPlans.findMany({
    where: { farmId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDraftPlanById(id: string): Promise<DraftPlanWithPlots | null> {
  const plan = await appDrizzle.query.cropRotationDraftPlans.findFirst({
    where: { id },
    with: { plots: { with: { entries: { with: { crop: { with: { family: true } } } } } } },
  });
  if (!plan) return null;
  return mapPlanResult(plan);
}

export async function updateDraftPlan(
  id: string,
  data: { name?: string; plots?: PlotInput[] },
  farmId: string
): Promise<DraftPlanWithPlots> {
  return appDrizzle.transaction(async (tx) => {
    if (data.name !== undefined) {
      await tx.update(cropRotationDraftPlans).set({ name: data.name }).where(eq(cropRotationDraftPlans.id, id));
    }

    if (data.plots !== undefined) {
      await tx.delete(cropRotationDraftPlanPlots).where(eq(cropRotationDraftPlanPlots.draftPlanId, id));

      for (const plotInput of data.plots) {
        const [plotRow] = await tx
          .insert(cropRotationDraftPlanPlots)
          .values({ farmId, draftPlanId: id, plotId: plotInput.plotId })
          .returning();

        if (plotInput.rotations.length > 0) {
          await tx.insert(cropRotationDraftPlanEntries).values(
            plotInput.rotations.map((r) => ({
              farmId,
              draftPlanPlotId: plotRow.id,
              cropId: r.cropId,
              sowingDate: r.sowingDate ?? null,
              fromDate: r.fromDate,
              toDate: r.toDate,
              recurrenceInterval: r.recurrenceInterval ?? null,
              recurrenceUntil: r.recurrenceUntil ?? null,
            }))
          );
        }
      }
    }

    const full = await tx.query.cropRotationDraftPlans.findFirst({
      where: { id },
      with: { plots: { with: { entries: { with: { crop: { with: { family: true } } } } } } },
    });

    return mapPlanResult(full!);
  });
}

export async function deleteDraftPlan(id: string): Promise<void> {
  await appDrizzle.delete(cropRotationDraftPlans).where(eq(cropRotationDraftPlans.id, id));
}

export async function buildPlanInput(id: string): Promise<CropRotationsPlanInput | null> {
  const plan = await getDraftPlanById(id);
  if (!plan) return null;

  return {
    plots: plan.plots.map((p) => ({
      plotId: p.plotId,
      rotations: p.rotations.map((r) => ({
        cropId: r.cropId,
        sowingDate: r.sowingDate ?? undefined,
        fromDate: r.fromDate,
        toDate: r.toDate,
        recurrence:
          r.recurrence != null
            ? { interval: r.recurrence.interval, until: r.recurrence.until ?? undefined }
            : undefined,
      })),
    })),
  };
}
