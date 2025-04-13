export type Point = {
  type: "Point";
  coordinates: [number, number];
};
export type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type BBox = [number, number, number, number];
