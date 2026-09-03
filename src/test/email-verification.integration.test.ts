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
import { sendVerificationEmailIfNeeded, verifyEmailToken } from "../user/user-verification";

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

// The HTTP server runs in Jest's main process, these tests in a worker, so a spy installed here
// never sees a mail sent by an endpoint. Requests are therefore asserted on status codes and on
// what ends up in the database; mail content is asserted by calling the sender in this process.
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

// Creating a farm is POST /v1/farm; /v1/farms is the GET-only list of the caller's farms
async function createFarm(jwt: string, name = farmBody.name) {
  const res = await request("POST", "/v1/farm", { ...farmBody, name }, jwt);
  expect(res.status).toBe(200);
  return res;
}

async function tokensFor(userId: string) {
  return getAdminDb().select().from(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
}

async function profileFor(userId: string) {
  const profile = await getAdminDb().query.profiles.findFirst({ where: { id: userId } });
  return profile!;
}

// The endpoint sends the mail without awaiting it, so the token row shows up a moment later
async function waitForToken(userId: string) {
  for (let i = 0; i < 60; i++) {
    const rows = await tokensFor(userId);
    if (rows.length > 0) return rows[rows.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("no verification token was created");
}

describe("Verification email trigger", () => {
  it("mints exactly one token when the first farm is created", async () => {
    const { jwt, userId } = await newUser();

    await createFarm(jwt);
    await waitForToken(userId);

    expect(await tokensFor(userId)).toHaveLength(1);
    const profile = await profileFor(userId);
    expect(profile.verificationEmailSentAt).not.toBeNull();
    expect(profile.emailVerified).toBe(false);
  });

  // The bug this feature started from: deleting a farm and creating a new one re-sent the mail
  it("does not trigger a second mail when another farm is created", async () => {
    const { jwt, userId } = await newUser();

    await createFarm(jwt, "Erster Hof");
    const first = await waitForToken(userId);

    await createFarm(jwt, "Zweiter Hof");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const tokens = await tokensFor(userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].token).toBe(first.token);
  });
});

describe("Verification email content", () => {
  it("addresses the user, carries the token and is idempotent", async () => {
    const { userId, email } = await newUser();

    await sendVerificationEmailIfNeeded(userId);

    expect(emailSpy).toHaveBeenCalledTimes(1);
    const sent = emailSpy.mock.calls[0][0];
    expect(sent.subject).toBe("Bestätige deine E-Mail-Adresse");
    expect(sent.to![0].email).toBe(email);

    const [token] = await tokensFor(userId);
    expect(sent.htmlContent).toContain(token.token);
    expect(sent.htmlContent).toContain("/auth/verify?token=");

    // A second call is a no-op: verificationEmailSentAt is already set
    await sendVerificationEmailIfNeeded(userId);
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(await tokensFor(userId)).toHaveLength(1);
  });
});

describe("Verification token exchange", () => {
  it("verifies the address and returns a login url", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    const token = await waitForToken(userId);

    const res = await request("POST", "/v1/auth/verify-email", { token: token.token });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { url: string } };
    expect(body.data.url).toContain("http");

    const profile = await profileFor(userId);
    expect(profile.emailVerified).toBe(true);
    expect(profile.welcomeEmailSentAt).not.toBeNull();
  });

  it("rejects a reused token and does not send a second welcome mail", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    const token = await waitForToken(userId);

    await request("POST", "/v1/auth/verify-email", { token: token.token });
    const sentAt = (await profileFor(userId)).welcomeEmailSentAt;

    const res = await request("POST", "/v1/auth/verify-email", { token: token.token });
    expect(res.status).toBe(410);
    expect((await profileFor(userId)).welcomeEmailSentAt).toEqual(sentAt);
  });

  // Two clicks landing at the same moment used to produce two welcome mails, because both
  // requests read the token and the profile before either had written anything back.
  it("claims the token once when it is exchanged twice at the same time", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    const token = await waitForToken(userId);

    const [first, second] = await Promise.all([
      request("POST", "/v1/auth/verify-email", { token: token.token }),
      request("POST", "/v1/auth/verify-email", { token: token.token }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 410]);
    expect((await profileFor(userId)).welcomeEmailSentAt).not.toBeNull();
  });

  it("rejects an expired token", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    const token = await waitForToken(userId);

    await getAdminDb()
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
});

describe("Welcome mail", () => {
  it("is sent once, after verification, and only syncs a contact with consent", async () => {
    const { userId, email } = await newUser();
    await sendVerificationEmailIfNeeded(userId);
    const [token] = await tokensFor(userId);
    emailSpy.mockClear();

    await verifyEmailToken(token.token);

    expect(emailSpy).toHaveBeenCalledTimes(1);
    const welcome = emailSpy.mock.calls[0][0];
    expect(welcome.subject).toBe("Willkommen bei Coltivio");
    expect(welcome.to![0].email).toBe(email);
    expect(welcome.htmlContent).toContain("Mitglied werden");
    // Consent gates the contact list only, the mail itself goes out either way
    expect(contactSpy).not.toHaveBeenCalled();
  });

  it("syncs the Brevo contact when consent was given", async () => {
    const { jwt, userId, email } = await newUser();
    const consentRes = await request("PATCH", "/v1/me", { newsletterConsent: true }, jwt);
    expect(consentRes.status).toBe(200);

    await sendVerificationEmailIfNeeded(userId);
    const [token] = await tokensFor(userId);
    await verifyEmailToken(token.token);

    expect(contactSpy).toHaveBeenCalledTimes(1);
    expect(contactSpy.mock.calls[0][0].email).toBe(email);
  });
});

describe("Resend verification email", () => {
  it("mints a new token and invalidates the previous one", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    const first = await waitForToken(userId);

    // Step around the five minute cooldown
    await getAdminDb()
      .update(emailVerificationTokens)
      .set({ createdAt: new Date(Date.now() - 10 * 60 * 1000) })
      .where(eq(emailVerificationTokens.id, first.id));

    const res = await request("POST", "/v1/me/verification-email", {}, jwt);
    expect(res.status).toBe(200);
    expect(await tokensFor(userId)).toHaveLength(2);

    const stale = await request("POST", "/v1/auth/verify-email", { token: first.token });
    expect(stale.status).toBe(410);

    const tokens = await tokensFor(userId);
    const fresh = tokens.find((row) => row.token !== first.token)!;
    const ok = await request("POST", "/v1/auth/verify-email", { token: fresh.token });
    expect(ok.status).toBe(200);
  });

  it("rate limits repeated resends", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    await waitForToken(userId);

    const res = await request("POST", "/v1/me/verification-email", {}, jwt);
    expect(res.status).toBe(429);
  });

  it("refuses to resend once the address is verified", async () => {
    const { jwt, userId } = await newUser();
    await createFarm(jwt);
    const token = await waitForToken(userId);
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

    const profile = await profileFor(userId);
    expect(profile.emailVerified).toBe(false);
    expect(profile.fullName).toBe("Test Bauer");
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

    expect((await profileFor(userId)).emailVerified).toBe(false);
  });
});
