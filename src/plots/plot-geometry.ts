import { SQL, sql } from "drizzle-orm";
import { MultiPolygon } from "../geo/geojson";

// Same repair as "Fix geometries" in QGIS (and the shapefile import): resolves self-intersections, keeps only the
// polygon parts and forces a counter-clockwise MultiPolygon. Invalid geometries make ST_Difference fail with a
// GEOS TopologyException, which blocks every plot drawn next to them.
export function repairedMultiPolygon(geometry: SQL): SQL<MultiPolygon> {
  return sql<MultiPolygon>`ST_ForcePolygonCCW(ST_Multi(ST_CollectionExtract(ST_MakeValid(${geometry}, 'method=structure'), 3)))`;
}
