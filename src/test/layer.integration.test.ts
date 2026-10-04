import { describe, it, expect, beforeEach } from "@jest/globals";

import { cleanDb, createTestUser, request } from "./helpers";

// ---------------------------------------------------------------------------
// Federal farm plots layer
// ---------------------------------------------------------------------------
describe("Federal farm plots layer", () => {
  beforeEach(cleanDb);

  it("returns the last updated date for authenticated users", async () => {
    const { jwt } = await createTestUser("layer-user@example.com", "password123");

    const res = await request("GET", "/v1/layers/plots/lastUpdated", undefined, jwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { lastUpdated: string } };
    expect(body.data.lastUpdated).toBeTruthy();
    expect(new Date(body.data.lastUpdated).toString()).not.toBe("Invalid Date");
  });

  it("requires authentication", async () => {
    const res = await request("GET", "/v1/layers/plots/lastUpdated");
    expect(res.status).toBe(401);
  });
});
