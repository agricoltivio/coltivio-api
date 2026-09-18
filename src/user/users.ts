import createHttpError from "http-errors";
import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { profiles } from "../db/schema";
import { removeNewsletterContact, upsertNewsletterContact } from "../brevo/brevo";

export type NewUser = typeof profiles.$inferInsert;
export type UpdatedUser = Partial<NewUser>;
export type User = typeof profiles.$inferSelect;

export function usersApi(authDb: RlsDb) {
  return {
    async createUser(newUser: NewUser): Promise<User> {
      return authDb.rls(async (tx) => {
        const [user] = await tx.insert(profiles).values(newUser).returning();
        return user;
      });
    },
    async getUserById(id: string): Promise<User> {
      return authDb.rls(async (tx) => {
        const [user] = await tx.select().from(profiles).where(eq(profiles.id, id));
        if (!user) {
          // Also the outcome when the row exists but RLS hides it (e.g. not a member of the
          // caller's active farm) — a 404 either way, never a 500, and never distinguishable
          // from "truly doesn't exist" to the caller.
          throw createHttpError(404, "User not found");
        }
        return user;
      });
    },
    async updateUser(id: string, updatedUser: UpdatedUser): Promise<User> {
      return authDb.rls(async (tx) => {
        const [user] = await tx.update(profiles).set(updatedUser).where(eq(profiles.id, id)).returning();
        return user;
      });
    },

    async setNewsletterConsent(id: string, consent: boolean): Promise<void> {
      const profile = await authDb.admin.query.profiles.findFirst({ where: { id } });
      if (!profile) throw createHttpError(404, "User not found");

      if (consent) {
        await upsertNewsletterContact({
          userId: profile.id,
          email: profile.email,
          firstName: profile.fullName,
          locale: profile.locale,
          verified: profile.emailVerified,
        });
      } else {
        await removeNewsletterContact({ userId: profile.id, email: profile.email });
      }
    },
  };
}
