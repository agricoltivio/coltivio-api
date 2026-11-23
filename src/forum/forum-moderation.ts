import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { captureException } from "@sentry/node";
import { forumReplies, forumThreads } from "../db/schema";
import { removeImagesOfReply, removeImagesOfThread } from "./forum-images";

export function forumModerationApi(db: RlsDb) {
  return {
    async isModerator(userId: string): Promise<boolean> {
      const row = await db.admin.query.forumModerators.findFirst({
        where: { userId },
      });
      return row !== undefined;
    },

    async getModeratorUserIds(): Promise<Set<string>> {
      const rows = await db.admin.query.forumModerators.findMany({});
      return new Set(rows.map((r) => r.userId));
    },

    async setThreadStatus(threadId: string, status: "open" | "closed"): Promise<void> {
      await db.admin.update(forumThreads).set({ status, updatedAt: new Date() }).where(eq(forumThreads.id, threadId));
    },

    async pinThread(threadId: string, pinned: boolean): Promise<void> {
      await db.admin
        .update(forumThreads)
        .set({ isPinned: pinned, updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId));
    },

    // The images are removed together with the post, so they don't stay reachable. If removing them fails they
    // are detached by the delete (FK set null) and the cleanup cron removes them.
    async deleteThread(threadId: string): Promise<void> {
      await removeImagesOfThread(threadId).catch(captureException);
      await db.admin.delete(forumThreads).where(eq(forumThreads.id, threadId));
    },

    async deleteReply(replyId: string): Promise<void> {
      await removeImagesOfReply(replyId).catch(captureException);
      await db.admin.delete(forumReplies).where(eq(forumReplies.id, replyId));
    },
  };
}
