import { and, eq, getTableColumns, inArray, isNull, ne, sql } from "drizzle-orm";
import { writeFileSync } from "fs";
import path from "path";
import { CropRotation, expandRecurrence } from "../crop-rotations/crop-rotations";
import { appDrizzle } from "../db/db";
import {
  cropProtectionApplications,
  cropRotations,
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

export type PlotCreateInput = Omit<typeof plots.$inferInsert, "id" | "farmId" | "geometry"> & {
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

export async function createPlot(plotInput: PlotCreateInput, farmId: string): Promise<Plot> {
  const result = await appDrizzle.transaction(async (tx) => {
    const [plot] = await tx
      .insert(plots)
      .values({
        ...plotInput,
        farmId,
        geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plotInput.geometry)})`,
      })
      .returning({ ...plotSelectColumns, geom: plots.geometry });

    await tx
      .update(plots)
      .set({
        geometry: sql<MultiPolygon>`ST_ForcePolygonCCW(ST_Multi(ST_Difference(${plots.geometry}, ${plot.geom})))`,
        size: sql<number>`ST_Area(ST_Transform(ST_Difference(${plots.geometry}, ${plot.geom}),2056))`,
      })
      .where(and(ne(plots.id, plot.id), sql`ST_Intersects(${plots.geometry}, ${plot.geom})`));
    return plot;
  });
  const plot = await getPlotById(result.id);
  return plot!;
}

export async function getPlotById(id: string): Promise<Plot | undefined> {
  const today = new Date();
  const plot = await appDrizzle.query.plots.findFirst({
    where: { id },
    with: {
      cropRotations: {
        where: {
          fromDate: { lte: today },
          OR: [
            { toDate: { gte: today } },
            {
              recurrence: {
                OR: [{ until: { isNull: true } }, { until: { gte: today } }],
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
      geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry"),
    },
  });
  if (plot) {
    const { cropRotations: rotations, ...rest } = plot;
    const [currentRotation] = rotations;
    return {
      ...rest,
      currentCropRotation: currentRotation
        ? (expandRecurrence(currentRotation, today, today).find(
            (rotation) => rotation.fromDate <= today && rotation.toDate >= today
          ) ?? null)
        : null,
    };
  }
  return undefined;
}

export async function getPlotsForFarm(farmId: string): Promise<Plot[]> {
  const today = new Date();
  const result = await appDrizzle.query.plots.findMany({
    where: { farmId },
    orderBy: (p, { asc }) => [asc(p.name), asc(p.localId), asc(p.usage)],
    with: {
      cropRotations: {
        orderBy: { fromDate: "desc" },
        where: {
          fromDate: { lte: today },
          OR: [
            { toDate: { gte: today } },
            {
              recurrence: {
                OR: [{ until: { isNull: true } }, { until: { gte: today } }],
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
      geometry: (t) => sql<MultiPolygon>`ST_AsGeoJSON(${t.geometry})::json`.as("geometry"),
    },
  });
  return result.map(({ cropRotations: rotations, ...plot }) => ({
    ...plot,
    currentCropRotation: rotations[0]
      ? (expandRecurrence(rotations[0], today, today).find(
          (rotation) => rotation.fromDate <= today && rotation.toDate >= today
        ) ?? null)
      : null,
  }));
}

export async function updatePlot(id: string, data: PlotUpdateInput, farmId: string): Promise<Plot> {
  const result = await appDrizzle.transaction(async (tx) => {
    const [plot] = await tx
      .update(plots)
      .set({
        ...data,
        geometry: data.geometry ? sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)})` : undefined,
      })
      .where(and(eq(plots.id, id), eq(plots.farmId, farmId)))
      .returning();

    if (data.geometry) {
      await tx
        .update(plots)
        .set({
          geometry: sql<MultiPolygon>`ST_ForcePolygonCCW(ST_Multi(ST_Difference(${plots.geometry}, ${plot.geometry})))`,
          size: sql<number>`ST_Area(ST_Transform(ST_Difference(${plots.geometry}, ${plot.geometry}),2056))`,
        })
        .where(and(ne(plots.id, plot.id), sql`ST_Intersects(${plots.geometry}, ${plot.geometry})`));
    }
    return plot;
  });
  const plot = await getPlotById(result.id);
  return plot!;
}

export async function deletePlot(id: string, farmId: string): Promise<void> {
  await appDrizzle.delete(plots).where(and(eq(plots.id, id), eq(plots.farmId, farmId)));
}

export async function splitPlot(
  plotId: string,
  subPlots: SplitPlotInput[],
  farmId: string,
  options:
    | { strategy: "keep_reference"; originalPlotName?: string }
    | { strategy: "delete_and_migrate"; migrateToIndex: number }
): Promise<Plot[]> {
  const createdIds = await appDrizzle.transaction(async (tx) => {
    const originalPlot = await tx.query.plots.findFirst({ where: { id: plotId } });
    if (!originalPlot) throw new Error("Plot not found");

    const ids: string[] = [];

    for (const subPlot of subPlots) {
      const [created] = await tx
        .insert(plots)
        .values({
          farmId,
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
      await tx
        .update(plots)
        .set({
          geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify({ type: "MultiPolygon", coordinates: [] })})`,
          size: 0,
          ...(options.originalPlotName ? { name: options.originalPlotName } : {}),
        })
        .where(eq(plots.id, plotId));
    } else {
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
        await tx.update(table).set({ plotId: targetId }).where(eq(table.plotId, plotId));
      }

      await tx.delete(plots).where(eq(plots.id, plotId));
    }

    return ids;
  });

  const result: Plot[] = [];
  for (const id of createdIds) {
    const plot = await getPlotById(id);
    if (plot) result.push(plot);
  }
  return result;
}

export async function mergePlots(
  plotIds: string[],
  plotData: {
    name: string;
    localId?: string;
    usage?: number;
    additionalUsages?: string;
    cuttingDate?: Date | null;
    additionalNotes?: string;
  },
  farmId: string,
  options: { strategy: "keep_reference" } | { strategy: "delete_and_migrate" }
): Promise<Plot> {
  const newPlotId = await appDrizzle.transaction(async (tx) => {
    // Collect source plot geometries into a single MultiPolygon (preserving individual polygon boundaries for future splitting)
    // Collect source plot geometries into a single MultiPolygon (preserving individual polygon boundaries for future splitting)
    const collectedGeometry = sql<MultiPolygon>`(SELECT ST_CollectionExtract(ST_Collect(${plots.geometry}), 3) FROM ${plots} WHERE ${inArray(plots.id, plotIds)})`;
    const collectedSize = sql<number>`(SELECT ST_Area(ST_Transform(ST_Collect(${plots.geometry}), 2056)) FROM ${plots} WHERE ${inArray(plots.id, plotIds)})`;

    const [newPlot] = await tx
      .insert(plots)
      .values({
        farmId,
        name: plotData.name,
        localId: plotData.localId,
        usage: plotData.usage,
        cuttingDate: plotData.cuttingDate,
        size: collectedSize,
        geometry: collectedGeometry,
      })
      .returning({ id: plots.id });

    if (options.strategy === "delete_and_migrate") {
      const migrationTables = [tillages, cropProtectionApplications, harvests, fertilizerApplications] as const;
      for (const table of migrationTables) {
        await tx.update(table).set({ plotId: newPlot.id }).where(inArray(table.plotId, plotIds));
      }
      await tx.delete(plots).where(inArray(plots.id, plotIds));
    } else {
      await tx
        .update(plots)
        .set({
          geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify({ type: "MultiPolygon", coordinates: [] })})`,
          size: 0,
        })
        .where(inArray(plots.id, plotIds));
    }

    return newPlot.id;
  });

  const plot = await getPlotById(newPlotId);
  return plot!;
}

export async function syncMissingLocalIds(): Promise<void> {
  await appDrizzle.transaction(async (tx) => {
    const clusters = await tx.$with("clusters").as(
      tx
        .select({
          farmId: plots.farmId,
          cluster: sql`UNNEST(ST_ClusterWithin(${plots.geometry}, 0.0005) over (partition by ${plots.farmId}))`.as(
            "cluster"
          ),
        })
        .from(plots)
        .where(isNull(plots.localId))
    );

    const envelopes = await tx.$with("envelopes").as(
      tx
        .select({
          farmId: clusters.farmId,
          box: sql`ST_Extent(${clusters.cluster})`.as("box"),
        })
        .from(clusters)
        .groupBy(clusters.farmId, clusters.cluster)
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

    const geoAdminParcels = await getParcelsForEnvelopes(plotGroups.map((group) => group.envelope));

    writeFileSync(path.join(__dirname, "geoparcels.json"), JSON.stringify(geoAdminParcels));

    const candidates = await tx.query.plots.findMany({ where: { localId: { isNull: true } } });
    const plotIdList = candidates.map((candidate) => candidate.id);

    for (const parcel of geoAdminParcels) {
      if (parcel.properties.number) {
        await tx
          .update(plots)
          .set({ localId: parcel.properties.number, name: parcel.properties.number })
          .where(
            and(
              inArray(plots.id, plotIdList),
              sql`ST_Within(${plots.geometry}, ST_Buffer(ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(parcel.geometry)})), 0.0001))`
            )
          );
      }
    }
  });
}
