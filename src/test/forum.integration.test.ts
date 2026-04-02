import { describe, it, expect, beforeEach } from "@jest/globals";
import { cleanDb, createTestUser, request } from "./helpers";
import { createUserWithFarm } from "./test-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createThread(jwt: string) {
  const res = await request(
    "POST",
    "/v1/forum/threads",
    { title: "Hello World", body: "My first post", type: "general" },
    jwt
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: { id: string; title: string } };
  return body.data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Forum — access control", () => {
  beforeEach(cleanDb);

  it("unauthenticated request is rejected", async () => {
    const res = await request("GET", "/v1/forum/threads");
    expect(res.status).toBe(401);
  });

  it("authenticated user without membership can read threads", async () => {
    const { jwt: posterJwt } = await createTestUser("poster@test.com", "password123");
    await createThread(posterJwt);

    const { jwt: readerJwt } = await createTestUser("reader@test.com", "password123");
    const res = await request("GET", "/v1/forum/threads", undefined, readerJwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { result: unknown[]; total: number } };
    expect(body.data.total).toBe(1);
  });

  it("authenticated user without membership can get thread by ID", async () => {
    const { jwt: posterJwt } = await createTestUser("poster@test.com", "password123");
    const thread = await createThread(posterJwt);

    const { jwt: readerJwt } = await createTestUser("reader@test.com", "password123");
    const res = await request("GET", `/v1/forum/threads/byId/${thread.id}`, undefined, readerJwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(thread.id);
  });

  it("authenticated user without membership can list replies", async () => {
    const { jwt: posterJwt } = await createTestUser("poster@test.com", "password123");
    const thread = await createThread(posterJwt);
    await request("POST", `/v1/forum/threads/byId/${thread.id}/replies`, { body: "A reply" }, posterJwt);

    const { jwt: readerJwt } = await createTestUser("reader@test.com", "password123");
    const res = await request("GET", `/v1/forum/threads/byId/${thread.id}/replies`, undefined, readerJwt);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { count: number } };
    expect(body.data.count).toBe(1);
  });

  it("authenticated user without membership can create a thread and reply", async () => {
    const { jwt } = await createTestUser("user@test.com", "password123");

    const thread = await createThread(jwt);
    expect(thread.title).toBe("Hello World");

    const replyRes = await request("POST", `/v1/forum/threads/byId/${thread.id}/replies`, { body: "Good reply" }, jwt);
    expect(replyRes.status).toBe(200);
  });

  it("user with farm and membership can also post", async () => {
    const { jwt } = await createUserWithFarm({}, "member@test.com", { withActiveMembership: true });
    const thread = await createThread(jwt);
    expect(thread.title).toBe("Hello World");
  });
});
