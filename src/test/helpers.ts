import crypto from "crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "../db/schema";

// Lazy singleton admin DB for direct state verification in tests
let _adminSql: ReturnType<typeof postgres> | null = null;
let _adminDb: ReturnType<typeof createAdminDb> | null = null;

function createAdminDb() {
  return drizzle(process.env.DATABASE_URL!, { relations });
}

export function getAdminSql() {
  if (!_adminSql) {
    _adminSql = postgres(process.env.DATABASE_URL!, { prepare: false });
  }
  return _adminSql;
}

export function getAdminDb() {
  if (!_adminDb) {
    _adminDb = createAdminDb();
  }
  return _adminDb;
}

/**
 * Creates a user via the admin endpoint and logs in to get a JWT.
 */
export async function createTestUser(email: string, password: string) {
  const adminKey = process.env.ADMIN_API_KEY!;

  const createRes = await request("POST", "/v1/auth/users", { email, password }, undefined, adminKey);
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create test user: ${body}`);
  }
  const {
    data: { id: userId },
  } = (await createRes.json()) as { data: { id: string } };

  const loginRes = await request("POST", "/v1/auth/login", { email, password });
  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`Failed to log in test user: ${body}`);
  }
  const {
    data: { token: jwt },
  } = (await loginRes.json()) as { data: { token: string } };

  return { jwt, userId };
}

/**
 * Truncates all public tables for test isolation.
 */
// PostGIS system tables that must never be truncated
const POSTGIS_SYSTEM_TABLES = new Set(["spatial_ref_sys"]);

export async function cleanDb() {
  const sql = getAdminSql();

  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  const appTables = tables.filter((t) => !POSTGIS_SYSTEM_TABLES.has(t.tablename));
  if (appTables.length > 0) {
    const tableNames = appTables.map((t) => `"${t.tablename}"`).join(", ");
    await sql.unsafe(`TRUNCATE ${tableNames} CASCADE`);
  }
}

/**
 * Fetch wrapper that prepends the test server base URL.
 */
export async function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  jwt?: string,
  adminKey?: string
) {
  const baseUrl = process.env.SERVER_URL!;
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }
  if (adminKey) {
    headers["x-admin-api-key"] = adminKey;
  }

  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Like `request` but accepts arbitrary headers for negative auth tests.
 */
export async function rawRequest(
  method: string,
  path: string,
  options?: {
    body?: Record<string, unknown> | string;
    headers?: Record<string, string>;
  }
) {
  const baseUrl = process.env.SERVER_URL!;
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  const body =
    typeof options?.body === "string" ? options.body : options?.body ? JSON.stringify(options.body) : undefined;

  return fetch(url, { method, headers, body });
}

/**
 * Signs a test JWT using HMAC-SHA256.
 */
export function signTestJwt(
  payload: Record<string, unknown>,
  secret: string,
  options?: { expiresInSeconds?: number }
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      iat: now,
      exp: now + (options?.expiresInSeconds ?? 3600),
      ...payload,
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
