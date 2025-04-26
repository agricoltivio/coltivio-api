import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { RlsDb } from "../db/db";
import {
  cropRotations,
  crops,
  farmIdColumnValue,
  plots,
  tillages,
} from "../db/schema";
import { MultiPolygon } from "../geo/geojson";

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

export type CropRotationCreateManyInput = {
  cropId: string;
  fromDate: Date;
  toDate?: Date;
  plotIds: string[];
};
export type CropRotationUpdateInput = Partial<CropRotationCreateInput>;

export function cropRotationsApi(rlsDb: RlsDb) {
  return {
    async getCropRotationsForPlot(plotId: string): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropRotations.findMany({
          where: eq(cropRotations.plotId, plotId),
          with: { crop: true },
        });
      });
    },

    async getCurreentCropRotationsForPlots(plotIds: string[]) {
      return rlsDb.rls(async (tx) => {
        const results = await tx.query.plots.findMany({
          where: inArray(plots.id, plotIds),
          with: {
            cropRotations: {
              orderBy: desc(cropRotations.fromDate),
              limit: 1,
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
          where: eq(cropRotations.id, id),
          with: { crop: true },
        });
      });
    },

    async getCropRotationsForFarm(
      fromDate: Date,
      toDate: Date
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
              lte(cropRotations.fromDate, toDate)
            )
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
      input: CropRotationCreateInput
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

    async createCropRotations(
      input: CropRotationCreateManyInput
    ): Promise<CropRotation[]> {
      return rlsDb.rls(async (tx) => {
        if (input.plotIds.length === 0) {
          return [];
        }

        const plotsWithExistingRotations = await tx.query.plots.findMany({
          where: inArray(plots.id, input.plotIds),
          with: { cropRotations: { orderBy: desc(cropRotations.fromDate) } },
        });

        const cropRotationIdsToUpdate: string[] = [];

        for (const plot of plotsWithExistingRotations) {
          const lastRotation = plot.cropRotations[0];
          if (lastRotation && !lastRotation.toDate) {
            cropRotationIdsToUpdate.push(lastRotation.id);
          }
        }

        if (cropRotationIdsToUpdate.length > 0) {
          await tx
            .update(cropRotations)
            .set({
              toDate: input.fromDate,
            })
            .where(inArray(cropRotations.id, cropRotationIdsToUpdate));
        }

        // we set the 'toDate' date from the latest entry to the 'fromDate' of the new entry
        const createdCropRotations = await tx
          .insert(cropRotations)
          .values(
            input.plotIds.map((plotId) => ({
              plotId,
              fromDate: input.fromDate,
              toDate: input.toDate,
              cropId: input.cropId,
              ...farmIdColumnValue,
            }))
          )
          .returning();

        return tx.query.cropRotations.findMany({
          where: inArray(
            cropRotations.id,
            createdCropRotations.map((cropRotation) => cropRotation.id)
          ),
          with: { crop: true },
        });
      });
    },

    async updateCropRotation(
      id: string,
      data: CropRotationUpdateInput
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
          orderBy: [desc(cropRotations.fromDate)],
        });
        return Array.from(
          new Set(
            result.map((rotation) => rotation.fromDate.getFullYear().toString())
          )
        );
      });
    },
  };
}
