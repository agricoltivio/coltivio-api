import createHttpError from "http-errors";
import JSZip from "jszip";

// A feature as read from the shapefile: polygon rings in the source CRS plus the raw DBF attributes.
// Rings are kept as plain linework; PostGIS (ST_BuildArea) later assembles outer rings and holes.
export type ShapefileFeature = {
  rings: number[][][];
  properties: Record<string, string>;
};

export type ParsedShapefile = {
  srid: number;
  format: ShapefileFormat;
  features: ShapefileFeature[];
};

export type ShapefilePlotFields = {
  externalId: string | null;
  name: string;
  localId: string | null;
  usage: number | null;
  usageName: string | null;
  // in m², null if the file has no usable size (falls back to computed area)
  size: number | null;
  municipality: string | null;
  parseErrors: string[];
  // true if the name or usage could not be read from the file and a default was used
  usedDefaults: boolean;
};

export type ShapefileFormat = {
  name: string;
  // true if the format does not read any attributes, only the geometries
  geometryOnly: boolean;
  matches: (fieldNames: string[]) => boolean;
  // defaultName is used when the file has no usable name/parcel number for the feature
  toPlotFields: (properties: Record<string, string>, defaultName: string) => ShapefilePlotFields;
};

// "Übrige Dauerwiesen (ohne Weiden)", used when the file has no usage code
export const DEFAULT_USAGE_CODE = 613;

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// "Betriebsansicht kul_poly" export (cantonal agricultural GIS, e.g. GR).
const kulPolyFormat: ShapefileFormat = {
  name: "kul_poly",
  geometryOnly: false,
  matches: (fieldNames) => ["AVParz", "LNFCode", "FlaeLN"].every((field) => fieldNames.includes(field)),
  toPlotFields: (properties, defaultName) => {
    const parseErrors: string[] = [];
    const externalId = emptyToNull(properties.Ident);
    const localId = emptyToNull(properties.AVParz);

    const usageCode = emptyToNull(properties.LNFCode);
    let usage = DEFAULT_USAGE_CODE;
    let usageDefaulted = true;
    if (usageCode !== null) {
      const parsedUsage = Number.parseInt(usageCode, 10);
      if (Number.isNaN(parsedUsage)) {
        parseErrors.push(`invalid usage code "${usageCode}"`);
      } else {
        usage = parsedUsage;
        usageDefaulted = false;
      }
    }

    // FlaeLN is given in Aren (1 a = 100 m²)
    const sizeInAres = emptyToNull(properties.FlaeLN);
    let size: number | null = null;
    if (sizeInAres !== null) {
      const parsedSize = Number.parseFloat(sizeInAres);
      if (Number.isNaN(parsedSize)) {
        parseErrors.push(`invalid size "${sizeInAres}"`);
      } else {
        size = Math.round(parsedSize * 100);
      }
    }

    return {
      externalId,
      name: localId ?? defaultName,
      localId,
      usage,
      usageName: emptyToNull(properties.Nutzung),
      size,
      municipality: emptyToNull(properties.Gemeinde),
      parseErrors,
      usedDefaults: localId === null || usageDefaulted,
    };
  },
};

// Fallback for shapefiles with unknown (or no) attributes: only the geometry is imported,
// size is computed from the polygon.
const geometryOnlyFormat: ShapefileFormat = {
  name: "geometry_only",
  geometryOnly: true,
  matches: () => true,
  toPlotFields: (_properties, defaultName) => ({
    externalId: null,
    name: defaultName,
    localId: null,
    usage: DEFAULT_USAGE_CODE,
    usageName: null,
    size: null,
    municipality: null,
    parseErrors: [],
    usedDefaults: true,
  }),
};

// Add further formats here when shapefiles with different property names show up.
// geometryOnlyFormat must stay last, it matches everything.
const shapefileFormats: ShapefileFormat[] = [kulPolyFormat, geometryOnlyFormat];

const SHAPE_TYPE_NULL = 0;
const POLYGON_SHAPE_TYPES = [5, 15, 25]; // Polygon, PolygonZ, PolygonM (x/y layout is identical)

function parseShp(buffer: Buffer): { rings: number[][][] }[] {
  const fileLengthInBytes = Math.min(buffer.readInt32BE(24) * 2, buffer.length);
  const records: { rings: number[][][] }[] = [];
  let offset = 100;
  while (offset + 8 <= fileLengthInBytes) {
    const contentLengthInBytes = buffer.readInt32BE(offset + 4) * 2;
    const contentStart = offset + 8;
    const shapeType = buffer.readInt32LE(contentStart);
    if (shapeType === SHAPE_TYPE_NULL) {
      records.push({ rings: [] });
    } else if (POLYGON_SHAPE_TYPES.includes(shapeType)) {
      const numberOfParts = buffer.readInt32LE(contentStart + 36);
      const numberOfPoints = buffer.readInt32LE(contentStart + 40);
      const partStartIndexes: number[] = [];
      for (let partIndex = 0; partIndex < numberOfParts; partIndex++) {
        partStartIndexes.push(buffer.readInt32LE(contentStart + 44 + partIndex * 4));
      }
      const pointsStart = contentStart + 44 + numberOfParts * 4;
      const rings: number[][][] = [];
      for (let partIndex = 0; partIndex < numberOfParts; partIndex++) {
        const firstPoint = partStartIndexes[partIndex];
        const endPoint = partIndex + 1 < numberOfParts ? partStartIndexes[partIndex + 1] : numberOfPoints;
        const ring: number[][] = [];
        for (let pointIndex = firstPoint; pointIndex < endPoint; pointIndex++) {
          const pointOffset = pointsStart + pointIndex * 16;
          ring.push([buffer.readDoubleLE(pointOffset), buffer.readDoubleLE(pointOffset + 8)]);
        }
        rings.push(ring);
      }
      records.push({ rings });
    } else {
      throw createHttpError(400, `Unsupported shape type ${shapeType}, only polygons are supported`);
    }
    offset = contentStart + contentLengthInBytes;
  }
  return records;
}

function parseDbf(buffer: Buffer, encoding: string): { fieldNames: string[]; records: Record<string, string>[] } {
  const numberOfRecords = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);

  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(encoding);
  } catch {
    decoder = new TextDecoder("latin1");
  }

  const fields: { name: string; length: number }[] = [];
  for (
    let descriptorOffset = 32;
    buffer[descriptorOffset] !== 0x0d && descriptorOffset < headerLength;
    descriptorOffset += 32
  ) {
    const nameBytes = buffer.subarray(descriptorOffset, descriptorOffset + 11);
    const nullIndex = nameBytes.indexOf(0);
    const name = nameBytes.subarray(0, nullIndex === -1 ? 11 : nullIndex).toString("latin1");
    fields.push({ name, length: buffer[descriptorOffset + 16] });
  }

  const records: Record<string, string>[] = [];
  for (let recordIndex = 0; recordIndex < numberOfRecords; recordIndex++) {
    const recordStart = headerLength + recordIndex * recordLength;
    // first byte is the deletion flag; deleted records still have a matching shape, so keep them aligned
    let fieldOffset = recordStart + 1;
    const record: Record<string, string> = {};
    for (const field of fields) {
      record[field.name] = decoder.decode(buffer.subarray(fieldOffset, fieldOffset + field.length)).trim();
      fieldOffset += field.length;
    }
    records.push(record);
  }
  return { fieldNames: fields.map((field) => field.name), records };
}

// Swiss coordinate systems are detected by their coordinate range, the .prj is not needed.
function detectSrid(buffer: Buffer): number {
  const minX = buffer.readDoubleLE(36);
  const minY = buffer.readDoubleLE(44);
  const maxX = buffer.readDoubleLE(52);
  const maxY = buffer.readDoubleLE(60);
  if (minX >= 2_400_000 && maxX <= 2_900_000 && minY >= 1_000_000 && maxY <= 1_350_000) return 2056; // LV95
  if (minX >= 400_000 && maxX <= 900_000 && minY >= 0 && maxY <= 350_000) return 21781; // LV03
  throw createHttpError(400, "Unsupported coordinate system, expected LV95 or LV03");
}

export async function parseShapefileZip(zipBuffer: Buffer): Promise<ParsedShapefile> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw createHttpError(400, "File is not a valid zip archive");
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.startsWith("__MACOSX/"));
  const shpEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".shp"));
  if (shpEntries.length !== 1) {
    throw createHttpError(400, "Zip must contain exactly one .shp file");
  }
  // Files are found by extension only, file names don't matter. Only if there are several files with the
  // same extension, the one with the same base name as the .shp is taken.
  const basePath = shpEntries[0].name.slice(0, -4).toLowerCase();
  const findByExtension = (extension: string) => {
    const candidates = entries.filter((entry) => entry.name.toLowerCase().endsWith(extension));
    if (candidates.length === 1) return candidates[0];
    return candidates.find((entry) => entry.name.toLowerCase() === basePath + extension);
  };
  const dbfEntry = findByExtension(".dbf");
  if (!dbfEntry) {
    throw createHttpError(400, "Zip must contain a .dbf file");
  }
  const cpgEntry = findByExtension(".cpg");
  const encoding = cpgEntry ? (await cpgEntry.async("string")).trim().toLowerCase() : "latin1";

  const shpBuffer = await shpEntries[0].async("nodebuffer");
  const dbfBuffer = await dbfEntry.async("nodebuffer");
  if (shpBuffer.length < 100 || dbfBuffer.length < 32) {
    throw createHttpError(400, "Shapefile is incomplete");
  }

  const srid = detectSrid(shpBuffer);
  const shapes = parseShp(shpBuffer);
  const { fieldNames, records } = parseDbf(dbfBuffer, encoding);
  const format = shapefileFormats.find((candidate) => candidate.matches(fieldNames)) ?? geometryOnlyFormat;

  if (shapes.length !== records.length) {
    throw createHttpError(400, "Number of shapes and attribute records do not match");
  }

  return {
    srid,
    format,
    features: shapes.map((shape, index) => ({ rings: shape.rings, properties: records[index] })),
  };
}
