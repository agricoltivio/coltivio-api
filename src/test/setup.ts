import path from "path";
import os from "os";
import fs from "fs";

const TEMP_FILE = path.join(os.tmpdir(), "coltivio-test-env.json");

const testEnv = JSON.parse(fs.readFileSync(TEMP_FILE, "utf-8")) as Record<string, string>;

process.env.DATABASE_URL = testEnv.DATABASE_URL;
process.env.JWT_SECRET = testEnv.JWT_SECRET;
process.env.ADMIN_API_KEY = testEnv.ADMIN_API_KEY;
process.env.STORAGE_SECRET = testEnv.STORAGE_SECRET;
process.env.STORAGE_PATH = testEnv.STORAGE_PATH;
process.env.BASE_URL = testEnv.BASE_URL;
process.env.SERVER_URL = testEnv.SERVER_URL;
