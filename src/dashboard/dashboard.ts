import { and, count, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { expandRecurrence } from "../crop-rotations/crop-rotations";
import { appDrizzle } from "../db/db";
import * as tables from "../db/schema";
import { Crop } from "../crops/crops";
import { MultiPolygon } from "../geo/geojson";

export type AnimalType = (typeof tables.animalType.enumValues)[number];
export type AnimalSex = (typeof tables.animalSex.enumValues)[number];

export interface DashboardStats {
  animals: {
    total: number;
    byType: { type: AnimalType; count: number }[];
    bySex: { sex: AnimalSex; count: number }[];
    bornThisYear: number;
    diedThisYear: number;
  };
  harvests: {
    totalKilos: number;
    byCrop: { cropName: string; conservationMethod: string | null; totalKilos: number }[];
    byPlot: { plotId: string; plotName: string; totalKilos: number; count: number }[];
  };
  fertilizerApplications: {
    totalCount: number;
    byFertilizer: { fertilizerName: string; type: "mineral" | "organic"; totalAmount: number; unit: string }[];
    byPlot: { plotId: string; plotName: string; count: number }[];
  };
  cropProtectionApplications: {
    totalCount: number;
    byProduct: { productName: string; totalAmount: number; unit: string }[];
    byPlot: { plotId: string; plotName: string; count: number }[];
  };
  plots: {
    total: number;
    totalAreaM2: number;
    byUsage: { usage: string; count: number; totalAreaM2: number }[];
  };
  cropRotations: {
    active: { cropName: string; category: string; plotCount: number; totalAreaM2: number }[];
  };
}

export type FieldEventType = "harvest" | "fertilizerApplication" | "cropProtectionApplication" | "tillage";

export interface FieldEvent {
  id: string;
  date: string;
  geometry: MultiPolygon;
  plotId: string;
  plotName: string;
  type: FieldEventType;
  action: string;
}

type CropRotationWithCropAndRecurrence = typeof tables.cropRotations.$inferSelect & {
  crop: Crop;
  recurrence: typeof tables.cropRotationYearlyRecurrences.$inferSelect | null;
  plot: Pick<typeof tables.plots.$inferSelect, "size">;
};

function computeActiveCropRotations(
  rotations: CropRotationWithCropAndRecurrence[]
): { cropName: string; category: string; plotCount: number; totalAreaM2: number }[] {
  const today = new Date();
  const byCrop = new Map<string, { plotIds: Set<string>; totalAreaM2: number }>();

  for (const rotation of rotations) {
    const expanded = expandRecurrence(rotation, today, today);
    if (expanded.length === 0) continue;

    const key = `${rotation.crop.name}::${rotation.crop.category}`;
    if (!byCrop.has(key)) byCrop.set(key, { plotIds: new Set(), totalAreaM2: 0 });
    const entry = byCrop.get(key)!;
    if (!entry.plotIds.has(rotation.plotId)) {
      entry.plotIds.add(rotation.plotId);
      entry.totalAreaM2 += rotation.plot.size;
    }
  }

  return Array.from(byCrop.entries()).map(([key, { plotIds, totalAreaM2 }]) => {
    const [cropName, category] = key.split("::");
    return { cropName, category, plotCount: plotIds.size, totalAreaM2 };
  });
}

export async function getDashboardStats(farmId: string, year: number): Promise<DashboardStats> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const [
    animalsByType,
    animalsBySex,
    bornThisYear,
    diedThisYear,
    harvestsByCrop,
    harvestsByPlot,
    fertAppsByFertilizer,
    fertAppsByPlot,
    cropProtAppsByProduct,
    cropProtAppsByPlot,
    plotsByUsage,
    activeCropRotations,
  ] = await Promise.all([
    appDrizzle
      .select({ type: tables.animals.type, count: count() })
      .from(tables.animals)
      .where(eq(tables.animals.farmId, farmId))
      .groupBy(tables.animals.type),
    appDrizzle
      .select({ sex: tables.animals.sex, count: count() })
      .from(tables.animals)
      .where(eq(tables.animals.farmId, farmId))
      .groupBy(tables.animals.sex),
    appDrizzle
      .select({ count: count() })
      .from(tables.animals)
      .where(
        and(
          eq(tables.animals.farmId, farmId),
          gte(tables.animals.dateOfBirth, yearStart),
          lte(tables.animals.dateOfBirth, yearEnd)
        )
      ),
    appDrizzle
      .select({ count: count() })
      .from(tables.animals)
      .where(
        and(
          eq(tables.animals.farmId, farmId),
          isNotNull(tables.animals.dateOfDeath),
          gte(tables.animals.dateOfDeath, yearStart),
          lte(tables.animals.dateOfDeath, yearEnd)
        )
      ),
    appDrizzle
      .select({
        cropName: tables.crops.name,
        conservationMethod: tables.harvests.conservationMethod,
        totalKilos: sql<number>`COALESCE(SUM(${tables.harvests.numberOfUnits} * ${tables.harvests.kilosPerUnit}), 0)`,
      })
      .from(tables.harvests)
      .innerJoin(tables.crops, eq(tables.harvests.cropId, tables.crops.id))
      .where(
        and(
          eq(tables.harvests.farmId, farmId),
          gte(tables.harvests.date, yearStart),
          lte(tables.harvests.date, yearEnd)
        )
      )
      .groupBy(tables.crops.name, tables.harvests.conservationMethod),
    appDrizzle
      .select({
        plotId: tables.plots.id,
        plotName: tables.plots.name,
        totalKilos: sql<number>`COALESCE(SUM(${tables.harvests.numberOfUnits} * ${tables.harvests.kilosPerUnit}), 0)`,
        count: count(),
      })
      .from(tables.harvests)
      .innerJoin(tables.plots, eq(tables.harvests.plotId, tables.plots.id))
      .where(
        and(
          eq(tables.harvests.farmId, farmId),
          gte(tables.harvests.date, yearStart),
          lte(tables.harvests.date, yearEnd)
        )
      )
      .groupBy(tables.plots.id, tables.plots.name),
    appDrizzle
      .select({
        fertilizerName: tables.fertilizers.name,
        type: tables.fertilizers.type,
        unit: tables.fertilizers.unit,
        totalAmount: sql<number>`COALESCE(SUM(${tables.fertilizerApplications.amountPerUnit} * ${tables.fertilizerApplications.numberOfUnits}), 0)`,
      })
      .from(tables.fertilizerApplications)
      .innerJoin(tables.fertilizers, eq(tables.fertilizerApplications.fertilizerId, tables.fertilizers.id))
      .where(
        and(
          eq(tables.fertilizerApplications.farmId, farmId),
          gte(tables.fertilizerApplications.date, yearStart),
          lte(tables.fertilizerApplications.date, yearEnd)
        )
      )
      .groupBy(tables.fertilizers.id, tables.fertilizers.name, tables.fertilizers.type, tables.fertilizers.unit),
    appDrizzle
      .select({ plotId: tables.plots.id, plotName: tables.plots.name, count: count() })
      .from(tables.fertilizerApplications)
      .innerJoin(tables.plots, eq(tables.fertilizerApplications.plotId, tables.plots.id))
      .where(
        and(
          eq(tables.fertilizerApplications.farmId, farmId),
          gte(tables.fertilizerApplications.date, yearStart),
          lte(tables.fertilizerApplications.date, yearEnd)
        )
      )
      .groupBy(tables.plots.id, tables.plots.name),
    appDrizzle
      .select({
        productName: tables.cropProtectionProducts.name,
        unit: tables.cropProtectionProducts.unit,
        totalAmount: sql<number>`COALESCE(SUM(${tables.cropProtectionApplications.amountPerUnit} * ${tables.cropProtectionApplications.numberOfUnits}), 0)`,
      })
      .from(tables.cropProtectionApplications)
      .innerJoin(
        tables.cropProtectionProducts,
        eq(tables.cropProtectionApplications.productId, tables.cropProtectionProducts.id)
      )
      .where(
        and(
          eq(tables.cropProtectionApplications.farmId, farmId),
          gte(tables.cropProtectionApplications.dateTime, yearStart),
          lte(tables.cropProtectionApplications.dateTime, new Date(year, 11, 31, 23, 59, 59))
        )
      )
      .groupBy(
        tables.cropProtectionProducts.id,
        tables.cropProtectionProducts.name,
        tables.cropProtectionProducts.unit
      ),
    appDrizzle
      .select({ plotId: tables.plots.id, plotName: tables.plots.name, count: count() })
      .from(tables.cropProtectionApplications)
      .innerJoin(tables.plots, eq(tables.cropProtectionApplications.plotId, tables.plots.id))
      .where(
        and(
          eq(tables.cropProtectionApplications.farmId, farmId),
          gte(tables.cropProtectionApplications.dateTime, yearStart),
          lte(tables.cropProtectionApplications.dateTime, new Date(year, 11, 31, 23, 59, 59))
        )
      )
      .groupBy(tables.plots.id, tables.plots.name),
    appDrizzle
      .select({
        usage: tables.plots.usage,
        count: count(),
        totalAreaM2: sql<number>`COALESCE(SUM(${tables.plots.size}), 0)`,
      })
      .from(tables.plots)
      .where(eq(tables.plots.farmId, farmId))
      .groupBy(tables.plots.usage),
    appDrizzle.query.cropRotations.findMany({
      where: { farmId },
      with: { crop: { with: { family: true } }, recurrence: true, plot: { columns: { size: true } } },
    }),
  ]);

  const totalAnimals = animalsByType.reduce((sum, row) => sum + row.count, 0);
  const totalKilos = harvestsByCrop.reduce((sum, row) => sum + Number(row.totalKilos), 0);
  const totalFertCount = fertAppsByPlot.reduce((sum, row) => sum + row.count, 0);
  const totalCropProtCount = cropProtAppsByPlot.reduce((sum, row) => sum + row.count, 0);
  const totalPlots = plotsByUsage.reduce((sum, row) => sum + row.count, 0);
  const totalAreaM2 = plotsByUsage.reduce((sum, row) => sum + Number(row.totalAreaM2), 0);

  return {
    animals: {
      total: totalAnimals,
      byType: animalsByType.map((r) => ({ type: r.type, count: r.count })),
      bySex: animalsBySex.map((r) => ({ sex: r.sex, count: r.count })),
      bornThisYear: bornThisYear[0]?.count ?? 0,
      diedThisYear: diedThisYear[0]?.count ?? 0,
    },
    harvests: {
      totalKilos,
      byCrop: harvestsByCrop.map((r) => ({
        cropName: r.cropName,
        conservationMethod: r.conservationMethod,
        totalKilos: Number(r.totalKilos),
      })),
      byPlot: harvestsByPlot.map((r) => ({
        plotId: r.plotId,
        plotName: r.plotName,
        totalKilos: Number(r.totalKilos),
        count: r.count,
      })),
    },
    fertilizerApplications: {
      totalCount: totalFertCount,
      byFertilizer: fertAppsByFertilizer.map((r) => ({
        fertilizerName: r.fertilizerName,
        type: r.type,
        totalAmount: Number(r.totalAmount),
        unit: r.unit,
      })),
      byPlot: fertAppsByPlot.map((r) => ({ plotId: r.plotId, plotName: r.plotName, count: r.count })),
    },
    cropProtectionApplications: {
      totalCount: totalCropProtCount,
      byProduct: cropProtAppsByProduct.map((r) => ({
        productName: r.productName,
        totalAmount: Number(r.totalAmount),
        unit: r.unit,
      })),
      byPlot: cropProtAppsByPlot.map((r) => ({ plotId: r.plotId, plotName: r.plotName, count: r.count })),
    },
    plots: {
      total: totalPlots,
      totalAreaM2,
      byUsage: plotsByUsage.map((r) => ({
        usage: r.usage != null ? String(r.usage) : "unknown",
        count: r.count,
        totalAreaM2: Number(r.totalAreaM2),
      })),
    },
    cropRotations: { active: computeActiveCropRotations(activeCropRotations) },
  };
}

export async function getFieldEvents(farmId: string, fromDate: Date, toDate: Date): Promise<FieldEvent[]> {
  const toDateEndOfDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59);

  const [harvests, fertilizerApplications, cropProtectionApplications, tillages] = await Promise.all([
    appDrizzle
      .select({
        id: tables.harvests.id,
        date: tables.harvests.date,
        geometry: sql<MultiPolygon>`ST_AsGeoJSON(${tables.harvests.geometry})::json`,
        plotId: tables.plots.id,
        plotName: tables.plots.name,
        cropName: tables.crops.name,
        conservationMethod: tables.harvests.conservationMethod,
      })
      .from(tables.harvests)
      .innerJoin(tables.plots, eq(tables.harvests.plotId, tables.plots.id))
      .innerJoin(tables.crops, eq(tables.harvests.cropId, tables.crops.id))
      .where(
        and(eq(tables.harvests.farmId, farmId), gte(tables.harvests.date, fromDate), lte(tables.harvests.date, toDate))
      ),

    appDrizzle
      .select({
        id: tables.fertilizerApplications.id,
        date: tables.fertilizerApplications.date,
        geometry: sql<MultiPolygon>`ST_AsGeoJSON(${tables.fertilizerApplications.geometry})::json`,
        plotId: tables.plots.id,
        plotName: tables.plots.name,
        fertilizerName: tables.fertilizers.name,
      })
      .from(tables.fertilizerApplications)
      .innerJoin(tables.plots, eq(tables.fertilizerApplications.plotId, tables.plots.id))
      .innerJoin(tables.fertilizers, eq(tables.fertilizerApplications.fertilizerId, tables.fertilizers.id))
      .where(
        and(
          eq(tables.fertilizerApplications.farmId, farmId),
          gte(tables.fertilizerApplications.date, fromDate),
          lte(tables.fertilizerApplications.date, toDate)
        )
      ),

    appDrizzle
      .select({
        id: tables.cropProtectionApplications.id,
        dateTime: tables.cropProtectionApplications.dateTime,
        geometry: sql<MultiPolygon>`ST_AsGeoJSON(${tables.cropProtectionApplications.geometry})::json`,
        plotId: tables.plots.id,
        plotName: tables.plots.name,
        productName: tables.cropProtectionProducts.name,
      })
      .from(tables.cropProtectionApplications)
      .innerJoin(tables.plots, eq(tables.cropProtectionApplications.plotId, tables.plots.id))
      .innerJoin(
        tables.cropProtectionProducts,
        eq(tables.cropProtectionApplications.productId, tables.cropProtectionProducts.id)
      )
      .where(
        and(
          eq(tables.cropProtectionApplications.farmId, farmId),
          gte(tables.cropProtectionApplications.dateTime, fromDate),
          lte(tables.cropProtectionApplications.dateTime, toDateEndOfDay)
        )
      ),

    appDrizzle
      .select({
        id: tables.tillages.id,
        date: tables.tillages.date,
        geometry: sql<MultiPolygon>`ST_AsGeoJSON(${tables.tillages.geometry})::json`,
        plotId: tables.plots.id,
        plotName: tables.plots.name,
        action: tables.tillages.action,
        customAction: tables.tillages.customAction,
      })
      .from(tables.tillages)
      .innerJoin(tables.plots, eq(tables.tillages.plotId, tables.plots.id))
      .where(
        and(eq(tables.tillages.farmId, farmId), gte(tables.tillages.date, fromDate), lte(tables.tillages.date, toDate))
      ),
  ]);

  const events: FieldEvent[] = [
    ...harvests.map((h) => ({
      id: h.id,
      date: h.date.toISOString().slice(0, 10),
      geometry: h.geometry,
      plotId: h.plotId,
      plotName: h.plotName,
      type: "harvest" as const,
      action:
        h.conservationMethod && h.conservationMethod !== "none"
          ? `${h.cropName} (${h.conservationMethod})`
          : h.cropName,
    })),
    ...fertilizerApplications.map((f) => ({
      id: f.id,
      date: f.date.toISOString().slice(0, 10),
      geometry: f.geometry,
      plotId: f.plotId,
      plotName: f.plotName,
      type: "fertilizerApplication" as const,
      action: f.fertilizerName,
    })),
    ...cropProtectionApplications.map((c) => ({
      id: c.id,
      date: c.dateTime.toISOString().slice(0, 10),
      geometry: c.geometry,
      plotId: c.plotId,
      plotName: c.plotName,
      type: "cropProtectionApplication" as const,
      action: c.productName,
    })),
    ...tillages.map((tl) => ({
      id: tl.id,
      date: tl.date.toISOString().slice(0, 10),
      geometry: tl.geometry,
      plotId: tl.plotId,
      plotName: tl.plotName,
      type: "tillage" as const,
      action: tl.action === "custom" && tl.customAction ? tl.customAction : tl.action,
    })),
  ];

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
