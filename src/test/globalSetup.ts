import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { DockerComposeEnvironment, Wait } from "testcontainers";
import postgres from "postgres";

const TEMP_FILE = path.join(os.tmpdir(), "coltivio-test-env.json");
const PROJECT_ROOT = path.resolve(__dirname, "../..");

export default async function globalSetup() {
  console.log("[test] Starting docker-compose environment...");

  const environment = await new DockerComposeEnvironment(PROJECT_ROOT, "docker-compose.test.yml")
    .withWaitStrategy("db-1", Wait.forHealthCheck())
    .up();

  const dbContainer = environment.getContainer("db-1");
  const dbHost = dbContainer.getHost();
  const dbPort = dbContainer.getMappedPort(5432);

  const databaseUrl = `postgres://postgres:postgres@${dbHost}:${dbPort}/postgres`;

  // Run setup SQL (creates extensions and federal_farm_plots)
  // Retry loop because postgis/postgis image can reset connections briefly during init
  console.log("[test] Running setup SQL...");
  const setupSqlContent = fs.readFileSync(path.join(PROJECT_ROOT, "scripts/setup-test-db.sql"), "utf-8");
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const adminSql = postgres(databaseUrl, { connect_timeout: 5, onnotice: () => {} });
      await adminSql.unsafe(setupSqlContent);
      const [{ count }] = await adminSql`SELECT COUNT(*)::int AS count FROM spatial_ref_sys WHERE srid = 4326`;
      console.log(`[test] spatial_ref_sys SRID 4326 rows: ${count}`);
      await adminSql.end();
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const isConnectionError = code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT";
      if (!isConnectionError || attempt === 10) throw err;
      console.log(`[test] DB not ready yet (attempt ${attempt}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Run drizzle migrations
  console.log("[test] Running drizzle migrations...");
  execSync("npx drizzle-kit migrate", {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  // Set env vars consumed by the app server
  const jwtSecret = "super-secret-jwt-token-with-at-least-32-characters-long";
  const adminApiKey = "test-admin-api-key";
  const storageSecret = "test-storage-secret-key";
  const storagePath = path.join(os.tmpdir(), "coltivio-test-storage");

  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = jwtSecret;
  process.env.ADMIN_API_KEY = adminApiKey;
  process.env.STORAGE_SECRET = storageSecret;
  process.env.STORAGE_PATH = storagePath;
  process.env.PORT = "0";

  console.log("[test] Starting app server...");
  const { startServer } = await import("../rest-server");
  const server = await startServer();

  const httpServer = server.servers[0];
  const address = httpServer.address();
  const serverPort = typeof address === "string" ? 0 : (address?.port ?? 0);

  // BASE_URL must be set after server starts so storage signed URLs point to the right port
  process.env.BASE_URL = `http://localhost:${serverPort}`;

  // Store references for teardown
  (globalThis as Record<string, unknown>).__COMPOSE__ = environment;
  (globalThis as Record<string, unknown>).__SERVER__ = server;

  // Write env snapshot for test worker processes
  const testEnv = {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    ADMIN_API_KEY: adminApiKey,
    STORAGE_SECRET: storageSecret,
    STORAGE_PATH: storagePath,
    BASE_URL: `http://localhost:${serverPort}`,
    SERVER_URL: `http://localhost:${serverPort}`,
  };
  fs.writeFileSync(TEMP_FILE, JSON.stringify(testEnv));

  console.log(`[test] Server listening on port ${serverPort}`);
  console.log(`[test] DB at ${dbHost}:${dbPort}`);
}
