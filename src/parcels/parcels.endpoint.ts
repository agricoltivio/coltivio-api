// import createHttpError from "http-errors";
// import { z } from "zod";
// import * as tables from "../db/schema";
// import { farmEndpointFactory } from "../endpoint-factory";

// export const getFarmParcelsEndpoint = farmEndpointFactory.build({
//   method: "get",
//   input: z.object({}),
//   output: z.object({
//     result: z.array(tables.selectParcelSchema),
//     count: z.number(),
//   }),
//   handler: async ({ ctx: { parcels, farmId } }) => {
//     const farmParcels = await parcels.getParcelsForFarm(farmId);

//     return { result: farmParcels, count: farmParcels.length };
//   },
// });

// export const getParcelByIdEndpoint = farmEndpointFactory.build({
//   method: "get",
//   input: z.object({ parcelId: z.string() }),
//   output: tables.selectParcelSchema,
//   handler: async ({ input, ctx: { parcels } }) => {
//     const farmParcel = await parcels.getParcelById(input.parcelId);
//     if (!farmParcel) {
//       throw createHttpError(404, "Farm Parcel not found");
//     }
//     return farmParcel;
//   },
// });

// const createFarmParcelSchema = tables.insertParcelSchema
//   .omit({
//     id: true,
//     geometry: true,
//   })
//   .merge(
//     z.object({
//       geometry: tables.multiPolygonSchema,
//     })
//   );
// export const createParcelsEndpoint = farmEndpointFactory.build({
//   method: "post",
//   input: z.object({ parcels: createFarmParcelSchema.array() }),
//   output: z.object({
//     result: z.array(tables.selectParcelSchema),
//     count: z.number(),
//   }),
//   handler: async ({ input, ctx: { parcels } }) => {
//     const result = await parcels.createParcels(input.parcels);
//     return { result, count: result.length };
//   },
// });

// export const copyFromFederalParcelsEndpoint = farmEndpointFactory.build({
//   method: "post",
//   input: z.object({ gisIds: z.array(z.number()) }),
//   output: z.object({
//     result: z.array(tables.selectParcelSchema),
//     count: z.number(),
//   }),
//   handler: async ({ input, ctx: { parcels } }) => {
//     const result = await parcels.copyFromFederalParcel(input.gisIds);
//     return { result, count: 0 };
//   },
// });

// export const updateParcelEndpoint = farmEndpointFactory.build({
//   method: "patch",
//   input: tables.updateParcelSchema
//     .omit({ id: true, farmId: true })
//     .extend({ parcelId: z.string() }),
//   output: tables.selectParcelSchema,
//   handler: async ({ input, ctx: { parcels } }) => {
//     return parcels.updateParcel(input.parcelId, input);
//   },
// });

// export const deleteParcelEndpoint = farmEndpointFactory.build({
//   method: "delete",
//   input: z.object({ parcelId: z.string() }),
//   output: z.object({}),
//   handler: async ({ input: { parcelId }, ctx: { parcels } }) => {
//     await parcels.deleteFarmParcel(parcelId);
//     return {};
//   },
// });
