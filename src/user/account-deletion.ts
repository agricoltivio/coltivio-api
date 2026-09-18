import createHttpError from "http-errors";
import { and, asc, eq, inArray } from "drizzle-orm";
import { captureException } from "@sentry/node";
import Stripe from "stripe";
import { adminDrizzle } from "../db/db";
import * as tables from "../db/schema";
import { supabase } from "../supabase/supabase";
import { getStripe } from "../stripe/stripe";
import { deleteNewsletterContact } from "../brevo/brevo";

// What happens to each of the user's farms when the account is deleted:
// leave: another owner remains, the user just drops out
// transfer: the user is the only owner but not alone, one of the other members must take over
// delete: the user is the only member, the farm goes with the account
export type DeletionOutcome = "leave" | "transfer" | "delete";

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

type AdminDb = typeof adminDrizzle;
type AdminTx = Parameters<Parameters<AdminDb["transaction"]>[0]>[0];

async function computePreview(
  db: AdminDb | AdminTx,
  userId: string,
  { lock }: { lock: boolean }
): Promise<DeletionPreviewFarm[]> {
  const memberships = await db
    .select({ farmId: tables.farmMembers.farmId })
    .from(tables.farmMembers)
    .where(eq(tables.farmMembers.userId, userId));
  if (memberships.length === 0) return [];

  const query = db
    .select({
      farmId: tables.farms.id,
      farmName: tables.farms.name,
      userId: tables.farmMembers.userId,
      role: tables.farmMembers.role,
      fullName: tables.profiles.fullName,
      email: tables.profiles.email,
    })
    .from(tables.farmMembers)
    .innerJoin(tables.farms, eq(tables.farms.id, tables.farmMembers.farmId))
    .innerJoin(tables.profiles, eq(tables.profiles.id, tables.farmMembers.userId))
    .where(
      inArray(
        tables.farmMembers.farmId,
        memberships.map((m) => m.farmId)
      )
    )
    .orderBy(asc(tables.farms.name), asc(tables.profiles.fullName));
  const rows = lock ? await query.for("update", { of: tables.farmMembers }) : await query;

  const farms = new Map<string, DeletionPreviewFarm & { selfRole?: string; hasOtherOwner: boolean }>();
  for (const row of rows) {
    const farm = farms.get(row.farmId) ?? {
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
    farms.set(row.farmId, farm);
  }

  return [...farms.values()].map(({ selfRole, hasOtherOwner, ...farm }) => {
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

export function accountDeletionApi() {
  return {
    async getDeletionPreview(userId: string): Promise<DeletionPreviewFarm[]> {
      return computePreview(adminDrizzle, userId, { lock: false });
    },

    // Only the account and its personal data go. Everything the user created in farms, the forum
    // or the wiki stays behind without an author, and membership payments stay as anonymous
    // bookkeeping records. The external services are cleaned up first so a failure there aborts
    // with nothing deleted, above all a Stripe subscription that would keep charging a gone user.
    async deleteAccount(userId: string, transfers: OwnershipTransfers): Promise<void> {
      assertTransfersMatch(await computePreview(adminDrizzle, userId, { lock: false }), transfers);

      const profile = await adminDrizzle.query.profiles.findFirst({ where: { id: userId } });
      if (!profile) throw createHttpError(404, "User not found");

      if (profile.stripeCustomerId) await deleteStripeCustomer(profile.stripeCustomerId);
      await deleteNewsletterContact(userId);

      await adminDrizzle.transaction(async (tx) => {
        const preview = await computePreview(tx, userId, { lock: true });
        assertTransfersMatch(preview, transfers);

        for (const farm of preview) {
          if (farm.outcome === "transfer") {
            await tx
              .update(tables.farmMembers)
              .set({ role: "owner" })
              .where(and(eq(tables.farmMembers.farmId, farm.id), eq(tables.farmMembers.userId, transfers[farm.id])));
          }
        }

        const farmsToDelete = preview.filter((farm) => farm.outcome === "delete").map((farm) => farm.id);
        if (farmsToDelete.length > 0) {
          await tx.delete(tables.farms).where(inArray(tables.farms.id, farmsToDelete));
        }

        await tx
          .update(tables.membershipPayments)
          .set({ userId: null, cardLast4: null, cardBrand: null, cardExpMonth: null, cardExpYear: null })
          .where(eq(tables.membershipPayments.userId, userId));

        await tx.delete(tables.profiles).where(eq(tables.profiles.id, userId));
      });

      // The profile is gone, so from here on the account counts as deleted. A leftover auth user
      // can't do anything without a profile, it only needs cleaning up by hand.
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) captureException(error, { extra: { userId, step: "delete auth user" } });
    },
  };
}
