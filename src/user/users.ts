import createHttpError from "http-errors";
import { and, asc, eq, inArray } from "drizzle-orm";
import { captureException } from "@sentry/node";
import Stripe from "stripe";
import { z } from "zod";
import { RlsDb } from "../db/db";
import { farmMembers, farms, membershipPayments, profiles } from "../db/schema";
import { supabase } from "../supabase/supabase";
import { getStripe } from "../stripe/stripe";
import { deleteNewsletterContact, removeNewsletterContact, upsertNewsletterContact } from "../brevo/brevo";

export type NewUser = typeof profiles.$inferInsert;
export type UpdatedUser = Partial<NewUser>;
export type User = typeof profiles.$inferSelect;

// What happens to each of the user's farms when the account is deleted:
// leave: another owner remains, the user just drops out
// transfer: the user is the only owner but not alone, one of the other members must take over
// delete: the user is the only member, the farm goes with the account
export const deletionOutcomeSchema = z.enum(["leave", "transfer", "delete"]);
export type DeletionOutcome = z.infer<typeof deletionOutcomeSchema>;

export type DeletionCandidate = { id: string; fullName: string | null; email: string };

export type DeletionPreviewFarm = {
  id: string;
  name: string;
  outcome: DeletionOutcome;
  candidates: DeletionCandidate[];
};

// farmId -> userId of the member who becomes owner
export type OwnershipTransfers = Record<string, string>;

export const PREVIEW_OUTDATED = "preview_outdated";

type AdminDb = RlsDb["admin"];
type AdminTx = Parameters<Parameters<AdminDb["transaction"]>[0]>[0];

async function computePreview(
  db: AdminDb | AdminTx,
  userId: string,
  { lock }: { lock: boolean }
): Promise<DeletionPreviewFarm[]> {
  const memberships = await db
    .select({ farmId: farmMembers.farmId })
    .from(farmMembers)
    .where(eq(farmMembers.userId, userId));
  if (memberships.length === 0) return [];

  const query = db
    .select({
      farmId: farms.id,
      farmName: farms.name,
      userId: farmMembers.userId,
      role: farmMembers.role,
      fullName: profiles.fullName,
      email: profiles.email,
    })
    .from(farmMembers)
    .innerJoin(farms, eq(farms.id, farmMembers.farmId))
    .innerJoin(profiles, eq(profiles.id, farmMembers.userId))
    .where(
      inArray(
        farmMembers.farmId,
        memberships.map((m) => m.farmId)
      )
    )
    .orderBy(asc(farms.name), asc(profiles.fullName));
  const rows = lock ? await query.for("update", { of: farmMembers }) : await query;

  const byFarm = new Map<string, DeletionPreviewFarm & { selfRole?: string; hasOtherOwner: boolean }>();
  for (const row of rows) {
    const farm = byFarm.get(row.farmId) ?? {
      id: row.farmId,
      name: row.farmName,
      outcome: "delete" as DeletionOutcome,
      candidates: [],
      hasOtherOwner: false,
    };
    if (row.userId === userId) {
      farm.selfRole = row.role;
    } else {
      farm.candidates.push({ id: row.userId, fullName: row.fullName, email: row.email });
      if (row.role === "owner") farm.hasOtherOwner = true;
    }
    byFarm.set(row.farmId, farm);
  }

  return [...byFarm.values()].map(({ selfRole, hasOtherOwner, ...farm }) => {
    if (selfRole !== "owner" || hasOtherOwner) return { ...farm, outcome: "leave", candidates: [] };
    if (farm.candidates.length > 0) return { ...farm, outcome: "transfer" };
    return { ...farm, outcome: "delete" };
  });
}

// The client picks the successors from a preview it fetched earlier. Anything that no longer
// lines up with the current state means that preview is stale, so the client has to reload it.
function assertTransfersMatch(preview: DeletionPreviewFarm[], transfers: OwnershipTransfers): void {
  const transferFarms = preview.filter((farm) => farm.outcome === "transfer");
  const matches =
    Object.keys(transfers).length === transferFarms.length &&
    transferFarms.every((farm) => farm.candidates.some((candidate) => candidate.id === transfers[farm.id]));
  if (!matches) throw createHttpError(409, PREVIEW_OUTDATED);
}

async function deleteStripeCustomer(customerId: string): Promise<void> {
  try {
    // Also cancels any running subscription immediately
    await getStripe().customers.del(customerId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return;
    throw error;
  }
}

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

    async getDeletionPreview(userId: string): Promise<DeletionPreviewFarm[]> {
      return computePreview(authDb.admin, userId, { lock: false });
    },

    // Only the account and its personal data go. Everything the user created in farms, the forum
    // or the wiki stays behind without an author, and membership payments stay as anonymous
    // bookkeeping records. The external services are cleaned up first so a failure there aborts
    // with nothing deleted, above all a Stripe subscription that would keep charging a gone user.
    async deleteAccount(userId: string, transfers: OwnershipTransfers): Promise<void> {
      assertTransfersMatch(await computePreview(authDb.admin, userId, { lock: false }), transfers);

      const profile = await authDb.admin.query.profiles.findFirst({ where: { id: userId } });
      if (!profile) throw createHttpError(404, "User not found");

      if (profile.stripeCustomerId) await deleteStripeCustomer(profile.stripeCustomerId);
      await deleteNewsletterContact(userId);

      await authDb.admin.transaction(async (tx) => {
        const preview = await computePreview(tx, userId, { lock: true });
        assertTransfersMatch(preview, transfers);

        for (const farm of preview) {
          if (farm.outcome === "transfer") {
            await tx
              .update(farmMembers)
              .set({ role: "owner" })
              .where(and(eq(farmMembers.farmId, farm.id), eq(farmMembers.userId, transfers[farm.id])));
          }
        }

        const farmsToDelete = preview.filter((farm) => farm.outcome === "delete").map((farm) => farm.id);
        if (farmsToDelete.length > 0) {
          await tx.delete(farms).where(inArray(farms.id, farmsToDelete));
        }

        await tx
          .update(membershipPayments)
          .set({ userId: null, cardLast4: null, cardBrand: null, cardExpMonth: null, cardExpYear: null })
          .where(eq(membershipPayments.userId, userId));

        await tx.delete(profiles).where(eq(profiles.id, userId));
      });

      // The profile is gone, so from here on the account counts as deleted. A leftover auth user
      // can't do anything without a profile, it only needs cleaning up by hand.
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) captureException(error, { extra: { userId, step: "delete auth user" } });
    },
  };
}
