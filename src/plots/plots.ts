import {
  and,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { writeFileSync } from "fs";
import path from "path";
import {
  CropRotation,
  expandRecurrence,
} from "../crop-rotations/crop-rotations";
import { RlsDb } from "../db/db";
import {
  cropProtectionApplications,
  cropRotations,
  farmIdColumnValue,
  fertilizerApplications,
  harvests,
  plots,
  tillages,
} from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { getParcelsForEnvelopes } from "../geoadmin/geoadmin";

export type SplitPlotInput = {
  geometry: MultiPolygon;
  name: string;
  size: number;
};

export type PlotCreateInput = Omit<
  typeof plots.$inferInsert,
  "id" | "farmId" | "geometry"
> & {
  geometry: MultiPolygon;
};
export type PlotUpdateInput = Partial<PlotCreateInput>;
export type Plot = Omit<typeof plots.$inferSelect, "geometry"> & {
  geometry: MultiPolygon;
  currentCropRotation: CropRotation | null;
};
const plotSelectColumns = {
  ...getTableColumns(plots),
  geometry: sql<MultiPolygon>`ST_AsGeoJSON(${plots.geometry})::json`,
};

export function plotsApi(rlsDb: RlsDb) {
  return {
    async createPlot(plotInput: PlotCreateInput): Promise<Plot> {
      const result = await rlsDb.rls(async (tx) => {
        const [plot] = await tx
          .insert(plots)
          .values({
            ...plotInput,
            ...farmIdColumnValue,
            geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plotInput.geometry)})`,
          })
          .returning({ ...plotSelectColumns, geom: plots.geometry });

        await tx
          .update(plots)
          .set({
            geometry: sql<MultiPolygon>`ST_ForcePolygonCCW(ST_Multi(ST_Difference(${plots.geometry}, ${plot.geom})))`,
            size: sql<number>`ST_Area(ST_Transform(ST_Difference(${plots.geometry}, ${plot.geom}),2056))`,
          })
          .where(
            and(
              ne(plots.id, plot.id),
              sql`ST_Intersects(${plots.geometry}, ${plot.geom})`,
            ),
          );
        return plot;
      });
      const plot = await this.getPlotById(result.id);
      return plot!;
    },

    async getPlotById(id: string): Promise<Plot | undefined> {
      return rlsDb.rls(async (tx) => {
        const today = new Date();
        const plot = await tx.query.plots.findFirst({
          where: { id },
          with: {
            cropRotations: {
              where: {
                fromDate: { lte: today },
                OR: [
                  { toDate: { gte: today } },
                  {
                    recurrence: {
                      OR: [
                        { until: { isNull: true } },
                        { until: { gte: today } },
                      ],
                    },
                  },
                ],
              },
              orderBy: { fromDate: "desc" },
              with: {
                crop: { with: { family: true } },
                recurrence: true,
              },
            },
          },
          extras: {
            geometry: (t) =>
              sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as(
                "geometry",
              ),
          },
        });
        if (plot) {
          const { cropRotations, ...rest } = plot;
          const [currentRotation] = cropRotations;
          return {
            ...rest,
            currentCropRotation: currentRotation
              ? (expandRecurrence(currentRotation, today, today).find(
                  (rotation) =>
                    rotation.fromDate <= today && rotation.toDate >= today,
                ) ?? null)
              : null,
          };
        }
      });
    },

    async getPlotsForFarm(farmId: string): Promise<Plot[]> {
      return rlsDb.rls(async (tx) => {
        const today = new Date();
        const plots = await tx.query.plots.findMany({
          where: { farmId },
          orderBy: (plots, { asc }) => [
            asc(plots.name),
            asc(plots.localId),
            asc(plots.usage),
          ],
          with: {
            cropRotations: {
              orderBy: { fromDate: "desc" },
              where: {
                fromDate: { lte: today },
                OR: [
                  { toDate: { gte: today } },
                  {
                    recurrence: {
                      OR: [
                        { until: { isNull: true } },
                        { until: { gte: today } },
                      ],
                    },
                  },
                ],
              },
              with: {
                crop: { with: { family: true } },
                recurrence: true,
              },
            },
          },
          extras: {
            geometry: (t) =>
              sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as(
                "geometry",
              ),
          },
        });
        return plots.map(({ cropRotations, ...plot }) => ({
          ...plot,
          currentCropRotation: cropRotations[0]
            ? (expandRecurrence(cropRotations[0], today, today).find(
                (rotation) =>
                  rotation.fromDate <= today && rotation.toDate >= today,
              ) ?? null)
            : null,
        }));
      });
    },

    async updatePlot(id: string, data: PlotUpdateInput): Promise<Plot> {
      const result = await rlsDb.rls(async (tx) => {
        const [plot] = await tx
          .update(plots)
          .set({
            ...data,
            geometry: data.geometry
              ? sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)})`
              : undefined,
          })
          .where(eq(plots.id, id))
          .returning();

        if (data.geometry) {
          await tx
            .update(plots)
            .set({
              geometry: sql<MultiPolygon>`ST_ForcePolygonCCW(ST_Multi(ST_Difference(${plots.geometry}, ${plot.geometry})))`,
              size: sql<number>`ST_Area(ST_Transform(ST_Difference(${plots.geometry}, ${plot.geometry}),2056))`,
            })
            .where(
              and(
                ne(plots.id, plot.id),
                sql`ST_Intersects(${plots.geometry}, ${plot.geometry})`,
              ),
            );
        }
        return plot;
      });
      const plot = await this.getPlotById(result.id);
      return plot!;
    },

    async deletePlot(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(plots).where(eq(plots.id, id));
      });
    },

    async splitPlot(
      plotId: string,
      subPlots: SplitPlotInput[],
      options:
        | { strategy: "keep_reference"; originalPlotName?: string }
        | { strategy: "delete_and_migrate"; migrateToIndex: number },
    ): Promise<Plot[]> {
      const createdIds = await rlsDb.rls(async (tx) => {
        const originalPlot = await tx.query.plots.findFirst({
          where: { id: plotId },
        });
        if (!originalPlot) throw new Error("Plot not found");

        const ids: string[] = [];

        // Create sub-plots
        for (const subPlot of subPlots) {
          const [created] = await tx
            .insert(plots)
            .values({
              ...farmIdColumnValue,
              name: subPlot.name,
              size: subPlot.size,
              usage: originalPlot.usage,
              cuttingDate: originalPlot.cuttingDate,
              localId: originalPlot.localId,
              geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(subPlot.geometry)})`,
            })
            .returning({ id: plots.id });
          ids.push(created.id);
        }

        if (options.strategy === "keep_reference") {
          // Original plot is kept as a reference only (for field calendar etc.) with no area.
          // All area goes to the sub-plots.
          await tx
            .update(plots)
            .set({
              geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify({ type: "MultiPolygon", coordinates: [] })})`,
              size: 0,
              ...(options.originalPlotName
                ? { name: options.originalPlotName }
                : {}),
            })
            .where(eq(plots.id, plotId));
        } else {
          // Migrate all historical references to the chosen sub-plot, then delete original
          const targetId = ids[options.migrateToIndex];
          if (!targetId) throw new Error("migrateToIndex out of bounds");

          const migrationTables = [
            cropRotations,
            tillages,
            cropProtectionApplications,
            harvests,
            fertilizerApplications,
          ] as const;
          for (const table of migrationTables) {
            await tx
              .update(table)
              .set({ plotId: targetId })
              .where(eq(table.plotId, plotId));
          }

          await tx.delete(plots).where(eq(plots.id, plotId));
        }

        return ids;
      });

      // Fetch and return all created sub-plots
      const result: Plot[] = [];
      for (const id of createdIds) {
        const plot = await this.getPlotById(id);
        if (plot) result.push(plot);
      }
      return result;
    },

    async mergePlots(
      plotIds: string[],
      plotData: {
        name: string;
        localId?: string;
        usage?: number;
        additionalUsages?: string;
        cuttingDate?: Date | null;
        additionalNotes?: string;
      },
      options:
        | { strategy: "keep_reference" }
        | { strategy: "delete_and_migrate" },
    ): Promise<Plot> {
      const newPlotId = await rlsDb.rls(async (tx) => {
        // Collect source plot geometries into a single MultiPolygon (preserving individual polygon boundaries for future splitting)
        const collectedGeometry = sql<MultiPolygon>`(SELECT ST_CollectionExtract(ST_Collect(${plots.geometry}), 3) FROM ${plots} WHERE ${inArray(plots.id, plotIds)})`;
        const collectedSize = sql<number>`(SELECT ST_Area(ST_Transform(ST_Collect(${plots.geometry}), 2056)) FROM ${plots} WHERE ${inArray(plots.id, plotIds)})`;

        const [newPlot] = await tx
          .insert(plots)
          .values({
            ...farmIdColumnValue,
            name: plotData.name,
            localId: plotData.localId,
            usage: plotData.usage,
            cuttingDate: plotData.cuttingDate,
            size: collectedSize,
            geometry: collectedGeometry,
          })
          .returning({ id: plots.id });

        if (options.strategy === "delete_and_migrate") {
          // Migrate relation tables (excluding cropRotations) from source plots to new plot
          const migrationTables = [
            tillages,
            cropProtectionApplications,
            harvests,
            fertilizerApplications,
          ] as const;
          for (const table of migrationTables) {
            await tx
              .update(table)
              .set({ plotId: newPlot.id })
              .where(inArray(table.plotId, plotIds));
          }

          // Delete source plots (cascade deletes their crop rotations)
          await tx.delete(plots).where(inArray(plots.id, plotIds));
        } else {
          // Set the source plots geometry and size to empty
          await tx
            .update(plots)
            .set({
              geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify({
                type: "MultiPolygon",
                coordinates: [],
              })})`,
              size: 0,
            })
            .where(inArray(plots.id, plotIds));
        }

        return newPlot.id;
      });

      const plot = await this.getPlotById(newPlotId);
      return plot!;
    },

    async syncMissingLocalIds(): Promise<void> {
      return rlsDb.rls(async (tx) => {
        const clusters = await tx.$with("clusters").as(
          tx
            .select({
              farmId: plots.farmId,
              cluster:
                sql`UNNEST(ST_ClusterWithin(${plots.geometry}, 0.0005) over (partition by ${plots.farmId}))`.as(
                  "cluster",
                ),
            })
            .from(plots)
            .where(isNull(plots.localId)),
        );

        const envelopes = await tx.$with("envelopes").as(
          tx
            .select({
              farmId: clusters.farmId,
              box: sql`ST_Extent(${clusters.cluster})`.as("box"),
            })
            .from(clusters)
            .groupBy(clusters.farmId, clusters.cluster),
        );

        const selectEsriEnvelope = sql<string>` 
        ST_XMin(${envelopes.box})::TEXT || ',' ||
        ST_YMin(${envelopes.box})::TEXT || ',' ||
        ST_XMax(${envelopes.box})::TEXT || ',' ||
        ST_YMax(${envelopes.box})::TEXT
        `;
        const plotGroups = await tx
          .with(clusters, envelopes)
          .select({ farmId: envelopes.farmId, envelope: selectEsriEnvelope })
          .from(envelopes);

        const geoAdminParcels = await getParcelsForEnvelopes(
          plotGroups.map((group) => group.envelope),
        );

        writeFileSync(
          path.join(__dirname, "geoparcels.json"),
          JSON.stringify(geoAdminParcels),
        );

        const candidates = await tx.query.plots.findMany({
          where: { localId: { isNull: true } },
        });
        const plotIds = candidates.map((candidate) => candidate.id);

        for (const parcel of geoAdminParcels) {
          if (parcel.properties.number) {
            await tx
              .update(plots)
              .set({
                localId: parcel.properties.number,
                name: parcel.properties.number,
              })
              .where(
                and(
                  inArray(plots.id, plotIds),
                  sql`ST_Within(${plots.geometry}, ST_Buffer(ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(parcel.geometry)})), 0.0001))`,
                ),
              );
          }
        }
      });
    },
  };
}
