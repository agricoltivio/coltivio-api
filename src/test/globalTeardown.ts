import type { StartedDockerComposeEnvironment } from "testcontainers";
import { disconnect } from "../db/db";

export default async function globalTeardown() {
  console.log("[test] Shutting down...");

  try {
    await disconnect();
  } catch {
    // connections may not have been established
  }

  const server = (globalThis as Record<string, unknown>).__SERVER__ as
    | { servers: Array<{ close: (cb?: () => void) => void }> }
    | undefined;
  if (server) {
    await Promise.all(server.servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  }

  const compose = (globalThis as Record<string, unknown>).__COMPOSE__ as StartedDockerComposeEnvironment | undefined;
  if (compose) {
    await compose.down();
  }

  console.log("[test] Teardown complete.");
}
