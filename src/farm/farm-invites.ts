import crypto from "crypto";
import createHttpError from "http-errors";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { TFunction } from "i18next";
import { RlsDb } from "../db/db";
import * as tables from "../db/schema";
import { User } from "../user/users";
import { sendFarmInviteEmail } from "./farm-invites.email";

const INVITE_TTL_DAYS = 7;

export type FarmInvite = typeof tables.farmInvites.$inferSelect;

export function farmInvitesApi(rlsDb: RlsDb, t: TFunction) {
  return {
    async createInvite(farmId: string, email: string, createdBy: string): Promise<FarmInvite> {
      return rlsDb.rls(async (tx) => {
        // Reject if a profile with that email already belongs to this farm
        const existingMember = await tx.query.profiles.findFirst({
          where: { email, farmId },
        });
        if (existingMember) {
          throw createHttpError(409, "User is already a member of this farm");
        }

        const code = crypto.randomBytes(4).toString("hex").toUpperCase();
        const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

        const [invite] = await tx
          .insert(tables.farmInvites)
          .values({ farmId, email, code, createdBy, expiresAt })
          .returning();

        // Fetch farm name for the email
        const farm = await tx.query.farms.findFirst({ where: { id: farmId } });
        await sendFarmInviteEmail(email, code, farm?.name ?? "a farm", t);

        return invite;
      });
    },

    async acceptInvite(code: string, user: User): Promise<User> {
      return rlsDb.admin.transaction(async (tx) => {
        const invite = await tx.query.farmInvites.findFirst({
          where: { code },
        });

        if (!invite) {
          throw createHttpError(404, "Invite not found");
        }
        if (invite.usedAt !== null) {
          throw createHttpError(410, "Invite has already been used");
        }
        if (invite.expiresAt < new Date()) {
          throw createHttpError(410, "Invite has expired");
        }
        if (user.email !== invite.email) {
          throw createHttpError(403, "This invite was sent to a different email address");
        }
        if (user.farmId !== null) {
          throw createHttpError(409, "You already belong to a farm");
        }

        // Assign user to the farm as member and mark invite as used
        const [updatedProfile] = await tx
          .update(tables.profiles)
          .set({ farmId: invite.farmId, farmRole: "member" })
          .where(eq(tables.profiles.id, user.id))
          .returning();

        await tx
          .update(tables.farmInvites)
          .set({ usedAt: sql`now()` })
          .where(eq(tables.farmInvites.id, invite.id));

        return updatedProfile;
      });
    },

    async listInvites(farmId: string): Promise<FarmInvite[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(tables.farmInvites)
          .where(
            and(
              eq(tables.farmInvites.farmId, farmId),
              isNull(tables.farmInvites.usedAt),
              gt(tables.farmInvites.expiresAt, new Date())
            )
          );
      });
    },

    async revokeInvite(id: string): Promise<void> {
      await rlsDb.rls(async (tx) => {
        await tx.delete(tables.farmInvites).where(eq(tables.farmInvites.id, id));
      });
    },
  };
}
