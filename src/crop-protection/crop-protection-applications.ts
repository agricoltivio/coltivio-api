import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { RlsDb } from "../db/db";
import {
  farmIdColumnValue,
  cropProtectionApplications,
  cropProtectionUnitSchema,
} from "../db/schema";
import { MultiPolygon } from "../geo/geojson";
import { Plot } from "../plots/plots";
import { CropProtectionEquipment } from "../equipment/crop-protection-equipment";
import { toDate } from "date-fns";
import { CropProtectionProduct } from "./crop-protection-products";
import { z } from "zod";

export type CropProtectionUnit = z.infer<typeof cropProtectionUnitSchema>;

export type CropProtectionApplicationCreateInput = Omit<
  typeof cropProtectionApplications.$inferInsert,
  "id" | "farmId" | "geometry"
> & {
  geometry: MultiPolygon;
};

export type CropProtectionApplicationBatchCreateInput = {
  createdBy: string;
  dateTime: Date;
  method: CropProtectionApplication["method"];
  equipmentId?: string;
  unit: CropProtectionApplication["unit"];
  additionalNotes?: string;
  productId: string;
  amountPerApplication: number;
  plots: {
    plotId: string;
    geometry: MultiPolygon;
    size: number;
    numberOfApplications: number;
  }[];
};
export type CropProtectionApplicationUpdateInput =
  Partial<CropProtectionApplicationCreateInput>;

export type CropProtectionApplication =
  typeof cropProtectionApplications.$inferSelect & {
    equipment: CropProtectionEquipment | null;
    geometry: MultiPolygon;
    product: CropProtectionProduct;
    plot: Omit<Plot, "cropRotations" | "geometry">;
  };

interface AppliedCropProtection {
  totalAmount: number;
  productName: string;
  unit: CropProtectionUnit;
}
interface MonthlyApplication {
  year: number;
  month: number;
  appliedCropProtections: AppliedCropProtection[];
}

export interface CropProtectionApplicationSummary {
  monthlyApplications: MonthlyApplication[];
}

export function cropProtectionApplicationsApi(rlsDb: RlsDb) {
  return {
    async createCropProtectionApplication(
      input: CropProtectionApplicationCreateInput
    ): Promise<CropProtectionApplication> {
      const result = await rlsDb.rls(async (tx) => {
        const [cropProtectionApplication] = await tx
          .insert(cropProtectionApplications)
          .values({
            ...farmIdColumnValue,
            ...input,
            geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)})`,
          })
          .returning();
        return cropProtectionApplication;
      });
      const cropProtectionApplication =
        await this.getCropProtectionApplicationById(result.id);
      return cropProtectionApplication!;
    },
    async createCropProtectionApplications({
      plots,
      ...base
    }: CropProtectionApplicationBatchCreateInput): Promise<
      CropProtectionApplication[]
    > {
      const result = await rlsDb.rls(async (tx) => {
        return tx
          .insert(cropProtectionApplications)
          .values(
            plots.map((plot) => ({
              ...farmIdColumnValue,
              ...base,
              ...plot,
              geometry: sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(plot.geometry)})`,
            }))
          )
          .returning({ id: cropProtectionApplications.id });
      });
      return this.getCropProtectionApplicationsByIds(
        result.map((application) => application.id)
      )!;
    },
    async getCropProtectionApplicationsByIds(
      ids: string[]
    ): Promise<CropProtectionApplication[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropProtectionApplications.findMany({
          where: inArray(cropProtectionApplications.id, ids),
          with: {
            equipment: true,
            plot: true,
            product: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${cropProtectionApplications.geometry})::json`.as(
                "geometry"
              ),
          },
        });
      });
    },
    async getCropProtectionApplicationById(
      id: string
    ): Promise<CropProtectionApplication | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropProtectionApplications.findFirst({
          where: eq(cropProtectionApplications.id, id),
          with: {
            equipment: true,
            plot: true,
            product: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${cropProtectionApplications.geometry})::json`.as(
                "geometry"
              ),
          },
        });
      });
    },
    async getCropProtectionApplicationsForPlot(
      plotId: string
    ): Promise<CropProtectionApplication[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropProtectionApplications.findMany({
          where: eq(cropProtectionApplications.plotId, plotId),
          with: {
            equipment: true,
            plot: true,
            product: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${cropProtectionApplications.geometry})::json`.as(
                "geometry"
              ),
          },
          orderBy: [desc(cropProtectionApplications.dateTime)],
        });
      });
    },
    async getCropProtectionApplicationsForFarm(
      farmId: string,
      fromDate: Date,
      toDate: Date
    ): Promise<CropProtectionApplication[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropProtectionApplications.findMany({
          where: and(
            eq(cropProtectionApplications.farmId, farmId),
            and(
              gte(cropProtectionApplications.dateTime, fromDate),
              lte(cropProtectionApplications.dateTime, toDate)
            )
          ),
          with: {
            equipment: true,
            plot: true,
            product: true,
          },
          extras: {
            geometry:
              sql<MultiPolygon>`ST_AsGeoJSON(${cropProtectionApplications.geometry})::json`.as(
                "geometry"
              ),
          },
          orderBy: [desc(cropProtectionApplications.dateTime)],
        });
      });
    },
    async updateCropProtectionApplication(
      id: string,
      data: CropProtectionApplicationUpdateInput
    ): Promise<CropProtectionApplication> {
      const result = await rlsDb.rls(async (tx) => {
        const geometry = data.geometry
          ? sql<MultiPolygon>`ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)})`
          : undefined;

        const [cropProtectionApplication] = await tx
          .update(cropProtectionApplications)
          .set({ ...data, geometry })
          .where(eq(cropProtectionApplications.id, id))
          .returning();
        return cropProtectionApplication;
      });
      const cropProtectionApplication =
        await this.getCropProtectionApplicationById(result.id);
      return cropProtectionApplication!;
    },
    async deleteCropProtectionApplication(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx
          .delete(cropProtectionApplications)
          .where(eq(cropProtectionApplications.id, id));
      });
    },
    async getCropProtectionApplicationYears(): Promise<string[]> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.cropProtectionApplications.findMany({
          columns: {
            dateTime: true,
          },
          orderBy: [asc(cropProtectionApplications.dateTime)],
        });

        return Array.from(
          new Set(
            result.map((application) =>
              application.dateTime.getFullYear().toString()
            )
          )
        );
      });
    },
    async getCropProtectionApplicationSummaryForFarm(): Promise<CropProtectionApplicationSummary> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.cropProtectionApplications.findMany({
          with: { product: true },
        });
        return mapToMonthlySummary(result);
      });
    },
    async getCropProtectionApplicationSummaryForPlot(
      plotId: string
    ): Promise<CropProtectionApplicationSummary> {
      return rlsDb.rls(async (tx) => {
        const result = await tx.query.cropProtectionApplications.findMany({
          with: { product: true },
          where: eq(cropProtectionApplications.plotId, plotId),
        });
        return mapToMonthlySummary(result);
      });
    },
  };
}

function mapToMonthlySummary(
  result: {
    unit: CropProtectionUnit;
    numberOfApplications: number;
    amountPerApplication: number;
    dateTime: Date;
    product: { id: string; name: string };
  }[]
) {
  const applications = result.reduce<{
    [key: string]: {
      month: number;
      year: number;
      appliedCropProtections: Record<
        string,
        { totalAmount: number; unit: CropProtectionUnit; productName: string }
      >;
    };
  }>((acc, application) => {
    const date = application.dateTime;
    const year = date.getFullYear();
    const month = date.getMonth(); // getMonth() is zero-based
    const product = application.product;

    const key = `${year}-${month}`;
    if (!acc[key]) {
      acc[key] = {
        month,
        year,
        appliedCropProtections: {
          [product.id]: {
            totalAmount: 0,
            unit: application.unit,
            productName: product.name,
          },
        },
      };
    } else if (!acc[key].appliedCropProtections[product.id]) {
      acc[key].appliedCropProtections[product.id] = {
        totalAmount:
          application.numberOfApplications * application.amountPerApplication,
        unit: application.unit,
        productName: product.name,
      };
    } else {
      acc[key].appliedCropProtections[product.id].totalAmount +=
        application.numberOfApplications * application.amountPerApplication;
    }
    return acc;
  }, {});
  return {
    monthlyApplications: Object.values(applications).map(
      ({ year, month, appliedCropProtections }) => ({
        year,
        month,
        appliedCropProtections: Object.values(appliedCropProtections),
      })
    ),
  };
}
