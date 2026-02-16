// import { describe, test } from "@jest/globals";
// import { readFileSync, writeFileSync } from "fs";
// import { join } from "path";
// import shp from "shpjs";

// describe.skip("shapefile conversion tests", () => {
//   test("write shapefile", async () => {
//     console.log(__dirname);
//     const shpFile = readFileSync(join(__dirname, "./sample/miadi.shp"));
//     const dbfFile = readFileSync(join(__dirname, "./sample/miadi.dbf"));
//     const cpgFile = readFileSync(join(__dirname, "./sample/miadi.cpg"));
//     const prjFiile = readFileSync(join(__dirname, "./sample/miadi.prj"));
//     const result = await shp.combine([
//       shp.parseShp(shpFile, prjFiile),
//       shp.parseDbf(dbfFile, cpgFile),
//     ]);

//     writeFileSync("miadi.json", JSON.stringify(result));
//     //   const result = await shp(join(__dirname, "./sample/miadi"));
//     //   console.log(result);
//     //   console.log(result.features[0].properties);
//   });
// });
