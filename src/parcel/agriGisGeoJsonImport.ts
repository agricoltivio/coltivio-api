// import { format } from "date-fns";
// import polylabel from "polylabel";
// import geojsonArea from "@mapbox/geojson-area";
// import { User } from "@prisma/client";
// import { getPrismaClient } from "../db";

// export interface AgriGisGeoJson {
//   type: string;
//   features: Feature[];
// }

// export interface Feature {
//   type: string;
//   geometry: Geometry;
//   properties: Properties;
// }

// export interface Geometry {
//   bbox: number[];
//   type: string;
//   coordinates: any;
// }

// export interface Properties {
//   Identifika: string;
//   Betriebsnr: string;
//   NutzCode: string;
//   NutzArt: string;
//   Lokalname: string;
//   Groesse: number;
//   Gemeinde: string;
//   Parzelle: string;
//   Bewirtgrad: string;
//   Beitragsbe: string;
//   Nutzung_im: string;
//   NHG: string;
//   Einzelkult: string;
//   Verpfl_von: string;
//   Verpfl_bis: string;
//   Schnittzei: string;
//   Programm: string;
//   Bezugsjahr: string;
//   Ist_Ueberl: boolean;
//   Ist_BFF_QI: boolean;
//   Ist_Spezia: boolean;
// }

// const usageCodesForHayProduction = ["0611", "0612", "0613", "0694", "0851"];
// const usageCodesWithNoFertilizationAllowed = ["0611", "0851"];

// type AreaInput = {
//   polygon: {
//     geometry: string;
//     pointOfInaccessibility: {
//       latitude: number;
//       longitude: number;
//     };
//   };
//   name: string;
//   agriGisId: string;
//   usageCode: string;
//   federalParcelId: string;
//   size: number;
//   eligableForStateContributions: boolean;
//   underContractSince?: string;
//   hayProduction?: {
//     earliestCuttingDate?: string;
//     productivityFactor: number;
//   };
//   fertilization?: {
//     allowed?: boolean;
//   };
// };

// type Position = [number, number];

// function findBiggestPolygon(coordinates: Position[][][]) {
//   let maxArea = 0,
//     maxPolygon: Position[][] = [];
//   for (let i = 0, l = coordinates.length; i < l; i++) {
//     const p: Position[][] = coordinates[i];
//     const area = geojsonArea.geometry({ type: "Polygon", coordinates: p });
//     if (area > maxArea) {
//       maxPolygon = p;
//       maxArea = area;
//     }
//   }
//   return maxPolygon;
// }
// export async function importAreasFromAgriGisGeoJson(
//   user: User,
//   agriGisGeoJson: string
// ) {
//   const prismaClient = getPrismaClient(user);
//   const geoJson: AgriGisGeoJson = JSON.parse(agriGisGeoJson);
//   const areaInputs: AreaInput[] = [];
//   for (const { geometry, properties } of geoJson.features) {
//     let coordinates = geometry.coordinates;
//     if (geometry.type == "MultiPolygon") {
//       coordinates = findBiggestPolygon(coordinates);
//     }
//     const [longitude, latitude] = polylabel(coordinates, 0.001);
//     const areaInput: AreaInput = {
//       polygon: {
//         geometry: JSON.stringify(geometry),
//         pointOfInaccessibility: {
//           latitude,
//           longitude,
//         },
//       },
//       name: properties.Lokalname,
//       agriGisId: properties.Identifika,
//       usageCode: properties.NutzCode,
//       federalParcelId: properties.Parzelle,
//       size: properties.Groesse,
//       eligableForStateContributions:
//         properties.Beitragsbe === "true" && properties.NutzCode !== "0898",
//       underContractSince:
//         properties.Verpfl_von && properties.Verpfl_von !== ""
//           ? properties.Verpfl_von
//           : undefined,
//     };
//     if (usageCodesForHayProduction.includes(properties.NutzCode)) {
//       areaInput.hayProduction = { productivityFactor: 1 };
//       // todo: maybe set productivity factor more intelligently
//       if (properties.Schnittzei !== "") {
//         areaInput.hayProduction.earliestCuttingDate = format(
//           new Date(properties.Schnittzei),
//           "MM-dd"
//         );
//       }
//     }
//     areaInput.fertilization = {
//       allowed: !usageCodesWithNoFertilizationAllowed.includes(
//         properties.NutzCode
//       ),
//     };
//     areaInputs.push(areaInput);
//   }
//   const areas = [];
//   const errors: string[] = [];
//   for (const {
//     polygon,
//     hayProduction,
//     fertilization,
//     federalParcelId,
//     ...areaData
//   } of areaInputs) {
//     try {
//       // const createdArea = await prismaClient.area.upsert({
//       //   create: {
//       //     ...areaData,
//       //     parcel: {
//       //       connectOrCreate: {
//       //         create: { parcelNumber: federalParcelId },
//       //         where: { parcelNumber: federalParcelId },
//       //       },
//       //     },
//       //     hayProduction: {
//       //       create: hayProduction,
//       //     },
//       //     fertilization: {
//       //       create: fertilization,
//       //     },
//       //     polygon: {
//       //       create: {
//       //         geometry: polygon.geometry,
//       //         poleOfInaccessibility: {
//       //           create: {
//       //             latitude: polygon.pointOfInaccessibility.latitude,
//       //             longitude: polygon.pointOfInaccessibility.longitude,
//       //           },
//       //         },
//       //       },
//       //     },
//       //   },
//       //   update: {},
//       //   where: {
//       //     agriGisId: areaData.agriGisId,
//       //   },
//       // });
//       // areas.push(createdArea);
//     } catch (error: any) {
//       console.error(
//         `error importing areas with agriGisId ${areaData.agriGisId}`,
//         error
//       );
//       errors.push(error.message);
//     }
//   }
//   // return { areas, errors };
// }
