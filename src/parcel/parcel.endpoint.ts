// import { z } from "zod";
// import {
//   AreaPolygonSchema,
//   AreaSchema,
//   FertilizationSchema,
//   GeoPointSchema,
//   ForageProductionSchema,
//   ParcelSchema,
// } from "../../prisma/generated/zod";
// import { getPrismaClient } from "../db";
// import { sessionEndpointFactory } from "../endpoint-factory";

// const FullAreaSchema = AreaSchema.extend({
//   forageProduction: ForageProductionSchema.nullable(),
//   fertilization: FertilizationSchema.nullable(),
//   polygon: AreaPolygonSchema.extend({
//     poleOfInaccessibility: GeoPointSchema.nullable(),
//   }).nullable(),
// });

// const ParcelWithAreasSchema = ParcelSchema.extend({
//   areas: FullAreaSchema.array(),
// });

// const AddAreaInput = z.object({
//   name: z.string(),
//   sizeInSquareMeters: z.number(),
//   polygon: z.object({
//     geometry: z.any().describe("GeoJSON geometry"),
//     poleOfInaccessibility: z.object({
//       latitude: z.number(),
//       longitude: z.number(),
//     }),
//   }),
//   additionalNotes: z.string().optional(),
// });

// const UpdateAreaInput = z.object({
//   name: z.string().optional(),
//   sizeInSquareMeters: z.number().optional(),
//   polygon: z.object({
//     geometry: z.any().optional().describe("GeoJSON geometry"),
//     poleOfInaccessibility: z
//       .object({
//         latitude: z.number(),
//         longitude: z.number(),
//       })
//       .optional(),
//   }),
//   additionalNotes: z.string().optional(),
// });

// export const getParcelByIdEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ parcelId: z.string() }),
//   output: ParcelWithAreasSchema,
//   handler: async ({ input: { parcelId }, options }) => {
//     return getPrismaClient(options.user).parcel.findUniqueOrThrow({
//       where: { id: parcelId },
//       include: {
//         areas: {
//           include: {
//             forageProduction: true,
//             harvests: true,
//             fertilization: true,
//             fertilizerApplications: true,
//             polygon: { include: { poleOfInaccessibility: true } },
//           },
//         },
//       },
//     });
//   },
// });

// export const getParcelsOfFarmEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ farmId: z.string() }),
//   output: z.object({
//     result: ParcelWithAreasSchema.array(),
//     count: z.number(),
//   }),
//   handler: async ({ input: { farmId }, options }) => {
//     const parcels = await getPrismaClient(options.user).parcel.findMany({
//       where: { farmId },
//       include: {
//         areas: {
//           include: {
//             forageProduction: true,
//             fertilization: true,
//             polygon: { include: { poleOfInaccessibility: true } },
//           },
//         },
//       },
//     });
//     return {
//       result: parcels,
//       count: parcels.length,
//     };
//   },
// });

// export const createParcelEndpoint = sessionEndpointFactory.build({
//   method: "post",
//   input: z.object({
//     farmId: z.string(),
//     name: z.string(),
//     parcelNumber: z.string(),
//     areas: AddAreaInput.array().min(1),
//   }),
//   output: ParcelWithAreasSchema,
//   handler: async ({ input, options }) => {
//     const prismaClient = getPrismaClient(options.user);
//     const parcel = await prismaClient.parcel.create({
//       data: {
//         farmId: input.farmId,
//         name: input.name,
//         parcelNumber: input.parcelNumber,
//       },
//     });
//     const areas = await Promise.all(
//       input.areas.map(async (area) => {
//         return await prismaClient.area.create({
//           data: {
//             parcelId: parcel.id,
//             name: area.name,
//             sizeInSquareMeters: area.sizeInSquareMeters,
//             additionalNotes: area.additionalNotes,
//             // polygon: {
//             //   create: {
//             //     geometry: area.polygon.geometry,

//             //     poleOfInaccessibility: {
//             //       create: {
//             //         ...area.polygon.poleOfInaccessibility,
//             //       },
//             //       // connectOrCreate: area.polygon.poleOfInaccessibility,
//             //     },
//             //   },
//             // },
//           },
//           include: {
//             forageProduction: true,
//             fertilization: true,
//             polygon: { include: { poleOfInaccessibility: true } },
//           },
//         });
//       })
//     );

//     return { ...parcel, areas };
//   },
// });

// export const updateParcelEndpoint = sessionEndpointFactory.build({
//   method: "patch",
//   input: z.object({
//     parcelId: z.string(),
//     name: z.string().optional(),
//     parcelNumber: z.string().optional(),
//   }),
//   output: ParcelSchema,
//   handler: async ({ input: { parcelId, ...parcel }, options }) => {
//     return getPrismaClient(options.user).parcel.update({
//       where: { id: parcelId },
//       data: parcel,
//     });
//   },
// });

// export const deleteParcelEndpoint = sessionEndpointFactory.build({
//   method: "delete",
//   input: z.object({ parcelId: z.string() }),
//   output: z.object({}),
//   handler: async ({ input: { parcelId }, options }) => {
//     return getPrismaClient(options.user).parcel.delete({
//       where: { id: parcelId },
//     });
//   },
// });

// export const getParcelAreasEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ parcelId: z.string() }),
//   output: z.object({ result: FullAreaSchema.array(), count: z.number() }),
//   handler: async ({ input: { parcelId }, options }) => {
//     const result = await getPrismaClient(options.user).area.findMany({
//       where: { parcelId },
//       include: {
//         forageProduction: true,
//         fertilization: true,
//         polygon: { include: { poleOfInaccessibility: true } },
//       },
//     });
//     return {
//       result,
//       count: result.length,
//     };
//   },
// });

// export const getAreaEndpoint = sessionEndpointFactory.build({
//   method: "get",
//   input: z.object({ areaId: z.string() }),
//   output: FullAreaSchema,
//   handler: async ({ input: { areaId }, options }) => {
//     return getPrismaClient(options.user).area.findUniqueOrThrow({
//       where: { id: areaId },
//       include: {
//         forageProduction: true,
//         fertilization: true,
//         polygon: { include: { poleOfInaccessibility: true } },
//       },
//     });
//   },
// });

// export const updateAreaEndpoint = sessionEndpointFactory.build({
//   method: "patch",
//   input: z
//     .object({
//       areaId: z.string(),
//     })
//     .and(UpdateAreaInput),
//   output: FullAreaSchema,
//   handler: async ({ input: { areaId, ...area }, options }) => {
//     return getPrismaClient(options.user).area.update({
//       where: { id: areaId },
//       data: {
//         name: area.name,
//         sizeInSquareMeters: area.sizeInSquareMeters,
//         additionalNotes: area.additionalNotes,
//         polygon: {
//           update: {
//             geometry: area.polygon?.geometry,
//             poleOfInaccessibility: {
//               update: {
//                 ...area.polygon?.poleOfInaccessibility,
//               },
//             },
//           },
//         },
//       },

//       include: {
//         forageProduction: true,
//         fertilization: true,
//         polygon: { include: { poleOfInaccessibility: true } },
//       },
//     });
//   },
// });

// // export const splitParcelAreaEndpoint = sessionEndpointFactory.build({
// //   method: "patch",
// //   input: z.object({
// //     parcelId: z.string(),
// //     existingArea: z.object({
// //       id: z.string(),
// //     }),
// //     newArea: AddAreaInput,
// //   }),
// //   output: z.object({
// //     result: FullAreaSchema.array(),
// //     count: z.number(),
// //   }),
// //   handler: async ({ input, options }) => {},
// // });

// // export const deleteParcelAreaEndpoint = sessionEndpointFactory.build({
// //   method: "delete",
// //   input: z.object({ parcelId: z.string(), id: z.string() }),
// //   output: z.object({}),
// //   handler: async ({ input, options }) => {
// //     const areaCount = await getPrismaClient(options.user).area.count({
// //       where: { parcelId: input.parcelId },
// //     });
// //     if (areaCount === 1) {
// //       throw createHttpError(400, "Parcel must have at least one area");
// //     }
// //     return getPrismaClient(options.user).area.delete({
// //       where: { id: input.id },
// //     });
// //   },
// // });

// // export const addParcelAreasEndpoint = sessionEndpointFactory.build({
// //   method: "post",
// //   input: z.object({ parcelId: z.string(), areas: AddAreaInput.array() }),
// //   output: z.object({ result: FullAreaSchema.array(), count: z.number() }),
// //   handler: async ({ input, options }) => {
// //     const areas = await Promise.all(
// //       input.areas.map(async (area) => {
// //         return await getPrismaClient(options.user).area.create({
// //           data: {
// //             parcelId: input.parcelId,
// //             name: area.name,
// //             sizeInSquareMeters: area.sizeInSquareMeters,
// //             additionalNotes: area.additionalNotes,
// //             polygon: {
// //               create: {
// //                 geometry: area.polygon.geometry,
// //                 poleOfInaccessibility: {
// //                   create: {
// //                     ...area.polygon.poleOfInaccessibility,
// //                   },
// //                 },
// //               },
// //             },
// //           },
// //           include: {
// //             polygon: { include: { poleOfInaccessibility: true } },
// //           },
// //         });
// //       })
// //     );
// //     return {
// //       result: areas,
// //       count: areas.length,
// //     };
// //   },
// // });
