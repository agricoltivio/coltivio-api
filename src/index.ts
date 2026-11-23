import "dotenv/config";
import { startServer } from "./rest-server";
import { startWikiImageCleanupCron } from "./wiki/wiki-cron";
import { startForumImageCleanupCron } from "./forum/forum-images-cron";
import { startMembershipExpiryCron } from "./membership/membership-expiry-cron";
import { startTaskDueCron } from "./tasks/task-due-cron";
import { startBreedingReminderCron } from "./animals/breeding-reminder-cron";

startServer().catch((err) => console.error(err));
startWikiImageCleanupCron();
startForumImageCleanupCron();
startMembershipExpiryCron();
startTaskDueCron();
startBreedingReminderCron();
