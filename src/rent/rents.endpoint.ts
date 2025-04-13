// import { z } from "zod";
// import { sessionEndpointFactory } from "../endpoint-factory";
// import * as tables from "../db/schema";
// import {
//   createRent,
//   deleteRent,
//   getRentById,
//   getRentForParcel,
//   getRentsForFarm,
//   updateRent,
// } from "./rents";
// import createHttpError from "http-errors";

// export const getRentsForFarmEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ farmId: z.string() }),
//   output: z.object({
//     result: z.array(tables.selectRentSchema),
//     count: z.number(),
//   }),
//   handler: async ({ input, options }) => {
//     const rents = await getRentsForFarm(input.farmId);

//     return { result: rents, count: rents.length };
//   },
// });

// export const getRentByIdEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ rentId: z.string() }),
//   output: tables.selectRentSchema,
//   handler: async ({ input, options }) => {
//     const rent = await getRentById(input.rentId);
//     if (!rent) {
//       throw createHttpError(404, "Rent not found");
//     }
//     return rent;
//   },
// });

// export const createRentEndpoint = sessionEndpointFactory.build({
//   method: "post",
//   input: tables.insertRentSchema,
//   output: tables.selectRentSchema,
//   handler: async ({ input, options }) => {
//     return createRent(input);
//   },
// });

// export const updateRentEndpoint = sessionEndpointFactory.build({
//   method: "patch",
//   input: tables.updateRentSchema,
//   output: tables.selectRentSchema,
//   handler: async ({ input, options }) => {
//     return updateRent(input.id, input);
//   },
// });

// export const deleteRentEndpoint = sessionEndpointFactory.build({
//   method: "delete",
//   input: z.object({ rentId: z.string() }),
//   output: z.object({}),
//   handler: async ({ input: { rentId }, options }) => {
//     await deleteRent(rentId);
//     return {};
//   },
// });
