import "dotenv/config";
import { startServer } from "./rest-server";
import { startWikiImageCleanupCron } from "./wiki/wiki-cron";

startServer().catch((err) => console.error(err));
startWikiImageCleanupCron();
