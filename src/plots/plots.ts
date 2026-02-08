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
  cropRotations,
  cropRotationYearlyRecurrences,
  farmIdColumnValue,
  plots,
} from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { getParcelsForEnvelopes } from "../geoadmin/geoadmin";

export type PlotCreateInput = Omit<
  typeof plots.$inferInsert,
  "id" | "farmId" | "geometry"
> & {
  cropId: string;
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

        const currentYear = new Date().getFullYear();
        const fromDate = new Date(currentYear, 0, 1); // Jan 1
        const toDate = new Date(currentYear, 11, 31); // Dec 31

        const [createdRotation] = await tx
          .insert(cropRotations)
          .values({
            ...farmIdColumnValue,
            plotId: plot.id,
            cropId: plotInput.cropId,
            fromDate,
            toDate,
          })
          .returning();

        // Create yearly recurrence for permanent rotation
        await tx.insert(cropRotationYearlyRecurrences).values({
          ...farmIdColumnValue,
          cropRotationId: createdRotation.id,
          interval: 1,
        });

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
