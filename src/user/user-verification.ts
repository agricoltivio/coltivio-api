import crypto from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import createHttpError from "http-errors";
import { adminDrizzle } from "../db/db";
import { emailVerificationTokens, profiles } from "../db/schema";
import { supabase } from "../supabase/supabase";
import { upsertNewsletterContact } from "../brevo/brevo";
import { sendVerificationEmail, sendWelcomeEmail } from "./user.email";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — a welcome mail may sit unread for days
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

const APP_URL = process.env.APP_URL ?? "https://app.coltivio.ch";
const MEMBERSHIP_URL = `${APP_URL}/membership`;

function verifyUrl(token: string): string {
  return `${APP_URL}/auth/verify?token=${token}`;
}

async function mintToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await adminDrizzle.insert(emailVerificationTokens).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

export async function sendVerificationEmailIfNeeded(userId: string): Promise<void> {
  const profile = await adminDrizzle.query.profiles.findFirst({ where: { id: userId } });
  if (!profile) return;
  if (profile.emailVerified || profile.verificationEmailSentAt) return;

  await adminDrizzle.update(profiles).set({ verificationEmailSentAt: new Date() }).where(eq(profiles.id, userId));

  const token = await mintToken(userId);
  await sendVerificationEmail({
    email: profile.email,
    fullName: profile.fullName,
    locale: profile.locale,
    verifyUrl: verifyUrl(token),
  });
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const profile = await adminDrizzle.query.profiles.findFirst({ where: { id: userId } });
  if (!profile) throw createHttpError(404, "User not found");
  if (profile.emailVerified) throw createHttpError(409, "Email already verified");

  const [latest] = await adminDrizzle
    .select({ createdAt: emailVerificationTokens.createdAt })
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId))
    .orderBy(desc(emailVerificationTokens.createdAt))
    .limit(1);

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw createHttpError(429, "A verification email was sent recently. Please wait a few minutes.");
  }

  await adminDrizzle
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)));

  if (!profile.verificationEmailSentAt) {
    await adminDrizzle.update(profiles).set({ verificationEmailSentAt: new Date() }).where(eq(profiles.id, userId));
  }

  const token = await mintToken(userId);
  await sendVerificationEmail({
    email: profile.email,
    fullName: profile.fullName,
    locale: profile.locale,
    verifyUrl: verifyUrl(token),
  });
}

export async function verifyEmailToken(token: string): Promise<{ url: string }> {
  const row = await adminDrizzle.query.emailVerificationTokens.findFirst({ where: { token } });

  if (!row) throw createHttpError(400, "Invalid verification token");
  if (row.usedAt) throw createHttpError(410, "Verification token already used");
  if (row.expiresAt < new Date()) throw createHttpError(400, "Verification token expired");

  // Claim the token in one conditional statement. Two requests arriving together both pass the
  // read-only checks above, and each would then send its own welcome mail.
  const [claimedToken] = await adminDrizzle
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailVerificationTokens.id, row.id), isNull(emailVerificationTokens.usedAt)))
    .returning({ id: emailVerificationTokens.id });
  if (!claimedToken) throw createHttpError(410, "Verification token already used");

  const profile = await adminDrizzle.query.profiles.findFirst({ where: { id: row.userId } });
  if (!profile) throw createHttpError(500, "User profile not found");

  await adminDrizzle.update(profiles).set({ emailVerified: true }).where(eq(profiles.id, profile.id));

  // Same reasoning: the timestamp is claimed conditionally, only the winner sends the mail.
  // Covers a second valid token for the same account too, not just a double click.
  const [claimedWelcome] = await adminDrizzle
    .update(profiles)
    .set({ welcomeEmailSentAt: new Date() })
    .where(and(eq(profiles.id, profile.id), isNull(profiles.welcomeEmailSentAt)))
    .returning({ id: profiles.id });

  if (claimedWelcome) {
    await sendWelcomeEmail({
      email: profile.email,
      fullName: profile.fullName,
      locale: profile.locale,
      membershipUrl: MEMBERSHIP_URL,
    });
  }

  if (profile.newsletterConsentAt) {
    await upsertNewsletterContact({
      email: profile.email,
      firstName: profile.fullName,
      locale: profile.locale,
    });
  }

  // Hand back a fresh magic link so the click also logs the user in, even on a device without a
  // session. Same primitive as the handoff flow.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { redirectTo: `${APP_URL}/auth/confirm` },
  });
  if (error || !data.properties?.action_link) {
    throw createHttpError(500, `Failed to generate magic link: ${error?.message ?? "no action_link in response"}`);
  }

  return { url: data.properties.action_link };
}
