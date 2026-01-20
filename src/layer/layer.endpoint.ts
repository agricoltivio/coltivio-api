import { z } from "zod";
import { authenticatedEndpointFactory } from "../endpoint-factory";
import { BBox } from "../geo/geojson";
import { ez } from "express-zod-api";
import { multiPolygonSchema } from "../db/schema";

interface ParcelLayerPolygon {
  id: string;
  gisId: number;
  area: number;
  communalId: string;
  labelX?: number;
  labelY?: number;
  geometry: Geometry;
}

interface Geometry {
  type: string;
  coordinates: number[][][][];
}

const BoundingBoxSchema = z.object({
  xmin: z.string().transform((value) => parseFloat(value)),
  ymin: z.string().transform((value) => parseFloat(value)),
  xmax: z.string().transform((value) => parseFloat(value)),
  ymax: z.string().transform((value) => parseFloat(value)),
});

const selectFederalFarmPlotSchema = z.object({
  id: z.number(),
  federalFarmId: z.string(),
  localId: z.string().nullable(),
  usage: z.number(),
  additionalUsages: z.string().nullable(),
  area: z.number(),
  cuttingDate: ez.dateOut().nullable(),
  canton: z.string(),
  geometry: multiPolygonSchema,
});

export const getPlotsLayerForBoundingBoxEndpoint =
  authenticatedEndpointFactory.build({
    method: "get",
    input: BoundingBoxSchema,
    output: z.object({
      result: selectFederalFarmPlotSchema.array(),
      count: z.number(),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      // bbox: z.object({
      //   xmin: z.number(),
      //   xmax: z.number(),
      //   ymin: z.number(),
      //   ymax: z.number(),
      // }),
    }),
    handler: async ({
      input: { xmax, xmin, ymax, ymin },
      ctx: { federalParcelLayer },
    }) => {
      const parcels = await federalParcelLayer.getPlotsLayerForBoundingBox(
        xmin,
        ymin,
        xmax,
        ymax,
      );
      const bbox: BBox = [xmin, ymin, xmax, ymax];

      return {
        result: parcels,
        bbox,
        count: parcels.length,
      };
    },
  });

export const getPlotsForFederalFarmIdEndpoint =
  authenticatedEndpointFactory.build({
    method: "get",
    input: z.object({ federalFarmId: z.string() }),
    output: z.object({
      result: selectFederalFarmPlotSchema.array(),
      count: z.number(),
    }),
    handler: async ({
      input: { federalFarmId },
      ctx: { federalParcelLayer },
    }) => {
      const parcels =
        await federalParcelLayer.getPlotsForFederalFarmId(federalFarmId);
      return {
        result: parcels,
        count: parcels.length,
      };
    },
  });

export const getFarmAndNearbyPlotsEndpoint = authenticatedEndpointFactory.build(
  {
    method: "get",
    input: z.object({
      federalFarmId: z.string(),
      buffer: z.number().optional(),
    }),
    output: z.object({
      result: selectFederalFarmPlotSchema.array(),
      count: z.number(),
    }),
    handler: async ({
      input: { federalFarmId, buffer },
      ctx: { federalParcelLayer },
    }) => {
      const parcels = await federalParcelLayer.getFarmAndNearbyPlots(
        federalFarmId,
        buffer,
      );
      return {
        result: parcels,
        count: parcels.length,
      };
    },
  },
);
export const getPlotsWithinRadiusOfPointEndpoint =
  authenticatedEndpointFactory.build({
    method: "get",
    input: z.object({
      longitude: z.string().transform((value) => parseFloat(value)),
      latitude: z.string().transform((value) => parseFloat(value)),
      radiusInKm: z.string().transform((value) => parseInt(value)),
    }),
    output: z.object({
      result: selectFederalFarmPlotSchema.array(),
      count: z.number(),
    }),
    handler: async ({
      input: { longitude, latitude, radiusInKm },
      ctx: { federalParcelLayer },
    }) => {
      const parcels = await federalParcelLayer.getPlotsWithinRadiusOfPoint(
        longitude,
        latitude,
        radiusInKm,
      );
      return {
        result: parcels,
        count: parcels.length,
      };
    },
  });

export const getFederalFarmIdsEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({
    query: z.string(),
    longitude: z.string().transform((value) => parseFloat(value)),
    latitude: z.string().transform((value) => parseFloat(value)),
    radiusInKm: z.string().transform((value) => parseInt(value)),
    limit: z.string().transform((limit) => parseInt(limit)),
  }),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { federalParcelLayer } }) => {
    const federalFarmIds = await federalParcelLayer.getFederalFarmIds(
      input.query,
      input.longitude,
      input.latitude,
      input.radiusInKm,
      input.limit,
    );
    return {
      result: federalFarmIds,
      count: federalFarmIds.length,
    };
  },
});
