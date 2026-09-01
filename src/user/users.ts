import createHttpError from "http-errors";
import { and, count, eq, inArray } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { farmMembers, profiles } from "../db/schema";
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
    // Blocks account deletion if it would leave any other farm (besides the one optionally being
    // deleted alongside it, via excludeFarmId) with zero owners. Deleting a profile cascades to
    // ALL of that user's farm_members rows, not just one farm's — so with multi-farm membership,
    // deleting your account through one farm's "delete farm + account" flow could otherwise
    // silently strand or fully orphan a completely different farm you also own.
    async assertCanDeleteAccount(id: string, excludeFarmId?: string): Promise<void> {
      const ownedMemberships = await authDb.admin.query.farmMembers.findMany({
        where: { userId: id, role: "owner" },
      });
      const otherOwnedFarmIds = ownedMemberships.map((m) => m.farmId).filter((farmId) => farmId !== excludeFarmId);
      if (otherOwnedFarmIds.length === 0) return;

      const ownerCounts = await authDb.admin
        .select({ farmId: farmMembers.farmId, count: count() })
        .from(farmMembers)
        .where(and(inArray(farmMembers.farmId, otherOwnedFarmIds), eq(farmMembers.role, "owner")))
        .groupBy(farmMembers.farmId);

      if (ownerCounts.some((row) => row.count === 1)) {
        throw createHttpError(
          409,
          "You are the only owner of another farm. Transfer ownership or delete it before deleting your account."
        );
      }
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
