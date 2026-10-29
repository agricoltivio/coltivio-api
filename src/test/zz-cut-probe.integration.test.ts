import { describe, it, beforeEach } from "@jest/globals";
import { cleanDb, request } from "./helpers";
import { createUserWithFarm, createPlot } from "./test-utils";

describe("cut probe", () => {
  beforeEach(cleanDb);
  it("prints the triangle cut geometry", async () => {
    const { jwt } = await createUserWithFarm();
    // slanted edge so the cut points are not on round coordinates
    const a = await createPlot(jwt, {
      name: "A",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [8.0, 47.0],
              [8.0103, 47.0007],
              [8.0097, 47.0101],
              [8.0, 47.01],
              [8.0, 47.0],
            ],
          ],
        ],
      },
    });
    // triangle reaching into A across its east edge
    await createPlot(jwt, {
      name: "B",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [8.0123, 47.0031],
              [8.0081, 47.0052],
              [8.0119, 47.0077],
              [8.0123, 47.0031],
            ],
          ],
        ],
      },
    });
    const res = await request("GET", `/v1/plots/byId/${a.id}`, undefined, jwt);
    const body = (await res.json()) as { data: { geometry: unknown } };
    console.log("CUT_PROBE " + JSON.stringify(body.data.geometry));
  });
});
