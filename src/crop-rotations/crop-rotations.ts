import { endOfDay, startOfDay, subDays } from "date-fns";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { hasOverlappingRanges, isInfiniteDate } from "../date-utils";
import { RlsDb } from "../db/db";
import { cropRotations, crops, farmIdColumnValue, plots } from "../db/schema";

export type CropRotation = typeof cropRotations.$inferSelect & {
  crop: typeof crops.$inferSelect;
};
export type CropRotationWithPlotName = CropRotation & {
  plot: { name: string };
};

export type CropRotationCreateInput = Omit<
  typeof cropRotations.$inferInsert,
  "id" | "farmId"
>;

export type CropRotationByCropCreateManyInput = {
  cropId: string;
  plots: Array<
    Omit<CropRotationCreateInput, "toDate"> &
      Required<Pick<CropRotationCreateInput, "toDate">>
  >;
};

export type CropRotationByPlotCreateManyInput = {
  plotId: string;
  crops: Array<{
    cropId: string;
    sowingDate?: Date;
    fromDate: Date;
    toDate: Date;
  }>;
};
export type CropRotationUpdateInput = Partial<CropRotationCreateInput>;

export function cropRotationsApi(rlsDb: RlsDb) {
  return {
    async getCropRotationsForPlot(plotId: string): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropRotations.findMany({
          where: { plotId },
          with: { crop: true },
        });
      });
    },

    async getCropRotationsForPlots(plotIds: string[], onlyCurrent: boolean) {
      return rlsDb.rls(async (tx) => {
        const results = await tx.query.plots.findMany({
          where: { id: { in: plotIds } },
          with: {
            cropRotations: {
              orderBy: { fromDate: "desc" },
              limit: onlyCurrent ? 1 : undefined,
              with: { crop: true },
            },
          },
        });
        return results.map((plot) => plot.cropRotations[0]).filter(Boolean);
      });
    },
    async getCropRotationById(id: string): Promise<CropRotation | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropRotations.findFirst({
          where: { id },
          with: { crop: true },
        });
      });
    },

    async getCropRotationsForFarm(
      fromDate: Date,
      toDate: Date,
    ): Promise<CropRotationWithPlotName[]> {
      return rlsDb.rls(async (tx) => {
        // return tx.query.cropRotations.findMany({
        //   where: and(
        //     eq(cropRotations.farmId, farmId),
        //     and(
        //       gte(cropRotations.fromDate, fromDate),
        //       lte(cropRotations.fromDate, toDate)
        //     )
        //   ),
        //   with: {
        //     crop: true,
        //     plot: { columns: { name: true } },
        //   },
        //   orderBy: desc(cropRotations.fromDate),
        // });

        const results = await tx
          .select()
          .from(cropRotations)
          .leftJoin(crops, eq(crops.id, cropRotations.cropId))
          .leftJoin(plots, eq(plots.id, cropRotations.plotId))
          .where(
            and(
              gte(cropRotations.fromDate, fromDate),
              lte(cropRotations.fromDate, toDate),
            ),
          )
          .orderBy(desc(cropRotations.fromDate));

        return results.map(({ crop_rotations, crops, plots }) => ({
          ...crop_rotations,
          crop: crops!,
          plot: plots!,
        }));
      });
    },
    async createCropRotation(
      input: CropRotationCreateInput,
    ): Promise<CropRotation> {
      const result = await rlsDb.rls(async (tx) => {
        const entries = await tx
          .select()
          .from(cropRotations)
          .where(eq(cropRotations.plotId, input.plotId))
          .orderBy(desc(cropRotations.fromDate))
          .limit(1);

        if (entries.length > 0) {
          const lastEntry = entries[0];
          if (!lastEntry.toDate) {
            await tx
              .update(cropRotations)
              .set({
                toDate: input.fromDate,
              })
              .where(eq(cropRotations.id, lastEntry.id));
          }
        }

        const [plotCrop] = await tx
          .insert(cropRotations)
          .values({
            ...input,
            ...farmIdColumnValue,
          })
          .returning();
        // we set the 'toDate' date from the latest entry to the 'fromDate' of the new entry

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
        const sortedCrops = input.crops.sort(
          (a, b) => a.fromDate.getTime() - b.fromDate.getTime(),
        );

        let existingCropRotations = await tx.query.cropRotations.findMany({
          where: {
            plotId: input.plotId,
          },
          columns: {
            id: true,
            plotId: true,
            fromDate: true,
            toDate: true,
          },
          orderBy: { fromDate: "asc" },
        });

        const newDateRanges = input.crops.map((crop) => ({
          fromDate: crop.fromDate,
          toDate: crop.toDate,
        }));

        const lastCropRotation = existingCropRotations.at(-1);

        if (lastCropRotation && isInfiniteDate(lastCropRotation.toDate)) {
          // if the last rotation was a permanent one marked with infinite date, we set the end date to the day before start date of the first new rotation
          await tx
            .update(cropRotations)
            .set({ toDate: endOfDay(subDays(sortedCrops[0].fromDate, 1)) })
            .where(eq(cropRotations.id, lastCropRotation.id));

          existingCropRotations = existingCropRotations.slice(0, -1);
        }

        const hasOverlap = hasOverlappingRanges([
          ...existingCropRotations,
          ...newDateRanges,
        ]);

        if (hasOverlap) {
          throw new Error("Overlapping date ranges");
        }

        const createdCropRotations = await tx
          .insert(cropRotations)
          .values(
            input.crops.map((plotRotation) => ({
              plotId: input.plotId,
              fromDate: plotRotation.fromDate,
              toDate: plotRotation.toDate,
              cropId: plotRotation.cropId,
              ...farmIdColumnValue,
            })),
          )
          .returning();

        return tx.query.cropRotations.findMany({
          where: {
            id: {
              in: createdCropRotations.map((cropRotation) => cropRotation.id),
            },
          },
          with: { crop: true },
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

        const existingCropRotations = await tx.query.cropRotations.findMany({
          where: {
            plotId: { in: input.plots.map((plot) => plot.plotId) },
          },
          columns: {
            id: true,
            plotId: true,
            fromDate: true,
            toDate: true,
          },
          orderBy: { fromDate: "asc" },
        });

        for (const plot of input.plots) {
          let cropRotationsForPlot = existingCropRotations.filter(
            (cropRotation) => cropRotation.plotId === plot.plotId,
          );

          const lastCropRotationForPlot = cropRotationsForPlot.at(-1);
          if (
            lastCropRotationForPlot &&
            isInfiniteDate(lastCropRotationForPlot.toDate)
          ) {
            // if the last rotation was a permanent one marked with infinite date, we set the end date to the day before start date of the new rotation
            await tx
              .update(cropRotations)
              .set({ toDate: startOfDay(subDays(plot.fromDate, 1)) })
              .where(eq(cropRotations.id, lastCropRotationForPlot.id));

            cropRotationsForPlot = cropRotationsForPlot.slice(0, -1);
          }
          const hasOverlap = hasOverlappingRanges([
            ...cropRotationsForPlot,
            { fromDate: plot.fromDate, toDate: plot.toDate },
          ]);
          if (hasOverlap) {
            throw new Error("Overlapping date ranges");
          }
        }

        const createdCropRotations = await tx
          .insert(cropRotations)
          .values(
            input.plots.map((plotRotation) => ({
              plotId: plotRotation.plotId,
              fromDate: plotRotation.fromDate,
              toDate: plotRotation.toDate,
              cropId: input.cropId,
              ...farmIdColumnValue,
            })),
          )
          .returning();

        return tx.query.cropRotations.findMany({
          where: {
            id: {
              in: createdCropRotations.map((cropRotation) => cropRotation.id),
            },
          },
          with: { crop: true },
        });
      });
    },

    async updateCropRotation(
      id: string,
      data: CropRotationUpdateInput,
    ): Promise<CropRotation> {
      const result = await rlsDb.rls(async (tx) => {
        const [plotCrop] = await tx
          .update(cropRotations)
          .set(data)
          .where(eq(cropRotations.id, id))
          .returning();
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
