import { describe, it, expect, beforeEach, beforeAll, afterEach, jest } from "@jest/globals";
import i18next from "i18next";
import de from "../../resources/locales/de.json";
import en from "../../resources/locales/en.json";
import itLocale from "../../resources/locales/it.json";
import fr from "../../resources/locales/fr.json";
import { eq, sql } from "drizzle-orm";
import { cleanDb, createTestUser, getAdminDb, request } from "./helpers";
import { emailVerificationTokens } from "../db/schema";
import * as brevo from "../brevo/brevo";
import { clientDrizzle } from "../db/db";

// Email helpers call getFixedT(locale), so i18next must be initialised in the worker
beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.init({
      resources: {
        de: { translation: de },
        en: { translation: en },
        it: { translation: itLocale },
        fr: { translation: fr },
      },
      fallbackLng: "de",
      preload: ["de", "en", "it", "fr"],
    });
  }
});

let emailSpy: jest.SpiedFunction<typeof brevo.txEmailApi.sendTransacEmail>;
let contactSpy: jest.SpiedFunction<typeof brevo.upsertNewsletterContact>;

beforeEach(async () => {
  await cleanDb();
  emailSpy = jest.spyOn(brevo.txEmailApi, "sendTransacEmail").mockImplementation(() => Promise.resolve());
  contactSpy = jest.spyOn(brevo, "upsertNewsletterContact").mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  emailSpy.mockRestore();
  contactSpy.mockRestore();
  jest.clearAllMocks();
});

let userCounter = 0;

async function newUser() {
  userCounter += 1;
  const email = `verify-${Date.now()}-${userCounter}@test.ch`;
  const { jwt, userId } = await createTestUser(email, "123456");
  return { jwt, userId, email };
}

const farmBody = {
  name: "Testhof",
  address: "Via Miadi 25, 6544 Braggio",
  location: { type: "Point", coordinates: [9.12, 46.3] },
};

async function createFarm(jwt: string, name = farmBody.name) {
  const res = await request("POST", "/v1/farms", { ...farmBody, name }, jwt);
  expect(res.status).toBe(200);
  return res;
}

// The endpoint fires the email without awaiting it, so give it a tick to land on the spy
async function flushBackgroundEmail() {
  for (let i = 0; i < 40; i++) {
    if (emailSpy.mock.calls.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function latestToken(userId: string) {
  const db = getAdminDb();
  const rows = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  return rows[rows.length - 1];
}

describe("Verification email trigger", () => {
  it("sends exactly one verification email when the first farm is created", async () => {
    const { jwt, userId, email } = await newUser();

    await createFarm(jwt);
    await flushBackgroundEmail();

    expect(emailSpy).toHaveBeenCalledTimes(1);
    const sent = emailSpy.mock.calls[0][0];
    expect(sent.subject).toBe("Bestätige deine E-Mail-Adresse");
    expect(sent.to![0].email).toBe(email);

    const token = await latestToken(userId);
    expect(token).toBeDefined();
    expect(sent.htmlContent).toContain(token.token);

    const db = getAdminDb();
    const profile = await db.query.profiles.findFirst({ where: { id: userId } });
    expect(profile!.verificationEmailSentAt).not.toBeNull();
    expect(profile!.emailVerified).toBe(false);
  });

  // The bug this feature started from: deleting a farm and creating a new one re-sent the mail
  it("does not send a second email when another farm is created", async () => {
    const { jwt } = await newUser();

    await createFarm(jwt, "Erster Hof");
    await flushBackgroundEmail();
    expect(emailSpy).toHaveBeenCalledTimes(1);

    await createFarm(jwt, "Zweiter Hof");
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(emailSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Verification token exchange", () => {
  it("verifies the address, sends the welcome email and returns a login url", async () => {
    const { jwt, userId, email } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();
    const token = await latestToken(userId);
    emailSpy.mockClear();

    const res = await request("POST", "/v1/auth/verify-email", { token: token.token });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { url: string } };
    expect(body.data.url).toContain("http");

    const db = getAdminDb();
    const profile = await db.query.profiles.findFirst({ where: { id: userId } });
    expect(profile!.emailVerified).toBe(true);
    expect(profile!.welcomeEmailSentAt).not.toBeNull();

    expect(emailSpy).toHaveBeenCalledTimes(1);
    const welcome = emailSpy.mock.calls[0][0];
    expect(welcome.subject).toBe("Willkommen bei Coltivio");
    expect(welcome.to![0].email).toBe(email);
    expect(welcome.htmlContent).toContain("Mitglied werden");
  });

  it("rejects a reused token and sends no second welcome email", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();
    const token = await latestToken(userId);

    await request("POST", "/v1/auth/verify-email", { token: token.token });
    emailSpy.mockClear();

    const res = await request("POST", "/v1/auth/verify-email", { token: token.token });
    expect(res.status).toBe(410);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  // Two clicks landing at the same moment used to produce two welcome mails, because both
  // requests read the token and the profile before either had written anything back.
  it("sends only one welcome email when the token is exchanged twice at once", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();
    const token = await latestToken(userId);
    emailSpy.mockClear();

    const [first, second] = await Promise.all([
      request("POST", "/v1/auth/verify-email", { token: token.token }),
      request("POST", "/v1/auth/verify-email", { token: token.token }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 410]);

    const welcomeMails = emailSpy.mock.calls.filter((call) => call[0].subject === "Willkommen bei Coltivio");
    expect(welcomeMails).toHaveLength(1);
  });

  it("rejects an expired token", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();
    const token = await latestToken(userId);

    const db = getAdminDb();
    await db
      .update(emailVerificationTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerificationTokens.id, token.id));

    const res = await request("POST", "/v1/auth/verify-email", { token: token.token });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    const res = await request("POST", "/v1/auth/verify-email", { token: "does-not-exist" });
    expect(res.status).toBe(400);
  });

  it("syncs the Brevo contact only when consent was given", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();

    const withoutConsent = await latestToken(userId);
    await request("POST", "/v1/auth/verify-email", { token: withoutConsent.token });
    expect(contactSpy).not.toHaveBeenCalled();

    const consenting = await newUser();
    await request("PATCH", "/v1/me", { newsletterConsent: true }, consenting.jwt);
    await createFarm(consenting.jwt);
    await flushBackgroundEmail();
    const token = await latestToken(consenting.userId);
    await request("POST", "/v1/auth/verify-email", { token: token.token });

    expect(contactSpy).toHaveBeenCalledTimes(1);
    expect(contactSpy.mock.calls[0][0].email).toBe(consenting.email);
  });
});

describe("Resend verification email", () => {
  it("sends a new mail and invalidates the previous token", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();
    const first = await latestToken(userId);

    const db = getAdminDb();
    // Step around the five minute cooldown
    await db
      .update(emailVerificationTokens)
      .set({ createdAt: new Date(Date.now() - 10 * 60 * 1000) })
      .where(eq(emailVerificationTokens.id, first.id));
    emailSpy.mockClear();

    const res = await request("POST", "/v1/me/verification-email", {}, jwt);
    expect(res.status).toBe(200);
    expect(emailSpy).toHaveBeenCalledTimes(1);

    const stale = await request("POST", "/v1/auth/verify-email", { token: first.token });
    expect(stale.status).toBe(410);

    const fresh = await latestToken(userId);
    const ok = await request("POST", "/v1/auth/verify-email", { token: fresh.token });
    expect(ok.status).toBe(200);
  });

  it("rate limits repeated resends", async () => {
    const { jwt } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();

    const res = await request("POST", "/v1/me/verification-email", {}, jwt);
    expect(res.status).toBe(429);
  });

  it("refuses to resend once the address is verified", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await flushBackgroundEmail();
    const token = await latestToken(userId);
    await request("POST", "/v1/auth/verify-email", { token: token.token });

    const res = await request("POST", "/v1/me/verification-email", {}, jwt);
    expect(res.status).toBe(409);
  });
});

describe("emailVerified cannot be set by the client", () => {
  it("ignores emailVerified in PATCH /v1/me", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);

    const res = await request("PATCH", "/v1/me", { emailVerified: true, fullName: "Test Bauer" }, jwt);
    expect(res.status).toBe(200);

    const db = getAdminDb();
    const profile = await db.query.profiles.findFirst({ where: { id: userId } });
    expect(profile!.emailVerified).toBe(false);
    expect(profile!.fullName).toBe("Test Bauer");
  });

  it("denies a direct column update through the authenticated role", async () => {
    const { userId } = await newUser();

    await expect(
      clientDrizzle.transaction(async (tx) => {
        await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, TRUE)`);
        await tx.execute(sql`set local role authenticated`);
        await tx.execute(sql`update profiles set email_verified = true where id = ${userId}::uuid`);
      })
    ).rejects.toThrow();

    const db = getAdminDb();
    const profile = await db.query.profiles.findFirst({ where: { id: userId } });
    expect(profile!.emailVerified).toBe(false);
  });
});
