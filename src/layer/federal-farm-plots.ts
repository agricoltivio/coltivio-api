import { and, eq, getColumns, sql } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { federalFarmPlots } from "../db/schema";
import { MultiPolygon } from "../geo/geojson";

const plotSelectColumns = {
  ...getColumns(federalFarmPlots),
  geometry: sql<MultiPolygon>`ST_AsGeoJSON(${federalFarmPlots.geometry})::json`,
};

export async function getPlotsForFederalFarmId(federalFarmId: string) {
  return appDrizzle
    .select(plotSelectColumns)
    .from(federalFarmPlots)
    .where(eq(federalFarmPlots.federalFarmId, federalFarmId));
}

export async function getFarmAndNearbyPlots(federalId: string, radiusInKm: number = 1) {
  const radiusInDegrees = (radiusInKm * 1000) / 111000.0;
  const bufferedBbox = appDrizzle.$with("buffered_bbox").as(
    appDrizzle
      .select({
        bbox: sql`ST_Buffer(ST_Envelope(ST_Union(${federalFarmPlots.geometry}))::geometry, ${radiusInDegrees})`.as(
          "bbox"
        ),
      })
      .from(federalFarmPlots)
      .where(eq(federalFarmPlots.federalFarmId, federalId))
  );

  return appDrizzle
    .with(bufferedBbox)
    .select(plotSelectColumns)
    .from(federalFarmPlots)
    .where(
      sql`ST_Intersects(${federalFarmPlots.geometry}, ${sql`(select ${bufferedBbox.bbox} from ${bufferedBbox})`})`
    );
}

export async function getPlotsWithinRadiusOfPoint(longitude: number, latitude: number, radiusInKm: number) {
  const radiusInDegrees = (radiusInKm * 1000) / 111000.0;
  return appDrizzle.select(plotSelectColumns).from(federalFarmPlots).where(sql`ST_DWithin(
    ${federalFarmPlots.geometry},
    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
    ${radiusInDegrees}
  )`);
}

export async function getPlotsLayerForBoundingBox(xmin: number, ymin: number, xmax: number, ymax: number) {
  return appDrizzle.select(plotSelectColumns).from(federalFarmPlots).where(sql`
    ST_Intersects(
      geometry,
      ST_MakeEnvelope(${xmin}, ${ymin}, ${xmax}, ${ymax}, 4326)
    )
  `);
}

export async function getFederalFarmIds(
  query: string,
  longitude: number,
  latitude: number,
  radiusInKm: number,
  limit: number
): Promise<string[]> {
  await appDrizzle.execute(sql.raw("select set_limit(0.2)"));
  const radiusInDegrees = (radiusInKm * 1000) / 111000.0;
  const result = await appDrizzle
    .selectDistinct({
      federalFarmId: federalFarmPlots.federalFarmId,
      similarity: sql`similarity(${federalFarmPlots.federalFarmId}, ${query})`,
    })
    .from(federalFarmPlots)
    .where(
      and(
        sql`ST_DWithin(${federalFarmPlots.geometry}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), ${radiusInDegrees})`,
        sql`${federalFarmPlots.federalFarmId} % ${query}`
      )
    )
    .orderBy(sql`similarity desc`)
    .limit(limit);
  return result.map(({ federalFarmId }) => federalFarmId);
}
