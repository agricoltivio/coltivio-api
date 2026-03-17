import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { profiles } from "../db/schema";
import { supabase } from "../supabase/supabase";
import { getStripe } from "../stripe/stripe";

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
        const [user] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.id, id));
        if (!user) {
          throw new Error(`User with id ${id} not found`);
        }
        return user;
      });
    },
    async updateUser(id: string, updatedUser: UpdatedUser): Promise<User> {
      return authDb.rls(async (tx) => {
        const [user] = await tx
          .update(profiles)
          .set(updatedUser)
          .where(eq(profiles.id, id))
          .returning();
        return user;
      });
    },
    async deleteUser(id: string) {
      // Fetch stripeCustomerId before deleting the profile row
      const profile = await authDb.admin.query.profiles.findFirst({ where: { id } });

      await authDb.rls(async (tx) => {
        await tx.delete(profiles).where(eq(profiles.id, id));
        await supabase.auth.admin.deleteUser(id);
      });

      // Delete Stripe customer to remove PII (email, name, payment methods) per GDPR
      if (profile?.stripeCustomerId) {
        await getStripe().customers.del(profile.stripeCustomerId);
      }
    },
  };
}
