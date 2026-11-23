import cron from "node-cron";
import { captureException } from "@sentry/node";
import { cleanupUnattachedForumImages } from "./forum-images";

// Hourly: removes uploads that never made it into a post and images detached by an edit or a deleted post
export function startForumImageCleanupCron(): void {
  cron.schedule("15 * * * *", async () => {
    try {
      const removedCount = await cleanupUnattachedForumImages();
      if (removedCount > 0) console.log(`[forum-images-cron] Removed ${removedCount} unattached image(s)`);
    } catch (err) {
      captureException(err);
      console.error("[forum-images-cron] Unattached image cleanup failed:", err);
    }
  });
}
