import { describe, it, expect, afterEach, jest } from "@jest/globals";
import type { ContactsApi } from "@getbrevo/brevo";

type BrevoModule = typeof import("./brevo");

const originalEnv = { ...process.env };
const contact = { userId: "user-1", email: "neu@test.ch", firstName: "Anna", locale: "de" };

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let createContact: jest.SpiedFunction<ContactsApi["createContact"]>;
let removeContactFromList: jest.SpiedFunction<ContactsApi["removeContactFromList"]>;

// brevo.ts reads its configuration at import time
function loadBrevo(configured = true): BrevoModule {
  if (configured) {
    process.env.BREVO_API_KEY = "test-key";
    process.env.BREVO_LIST_ID = "7";
  } else {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_LIST_ID;
  }
  let brevo!: BrevoModule;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const sdk = require("@getbrevo/brevo") as typeof import("@getbrevo/brevo");
    createContact = jest.spyOn(sdk.ContactsApi.prototype, "createContact").mockResolvedValue({} as never);
    removeContactFromList = jest
      .spyOn(sdk.ContactsApi.prototype, "removeContactFromList")
      .mockResolvedValue({} as never);
    brevo = require("./brevo") as BrevoModule;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return brevo;
}

function respondWith(...statuses: number[]) {
  fetchSpy = jest.spyOn(globalThis, "fetch");
  for (const status of statuses) {
    fetchSpy.mockResolvedValueOnce(new Response(status === 204 ? null : "{}", { status }));
  }
}

function fetchCall(index: number) {
  const [url, init] = fetchSpy.mock.calls[index];
  return { url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) };
}

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe("upsertNewsletterContact", () => {
  it("updates the contact keyed by user id with the current address", async () => {
    respondWith(204);
    await loadBrevo().upsertNewsletterContact(contact);

    const call = fetchCall(0);
    expect(call.url).toContain("/contacts/user-1?identifierType=ext_id");
    expect(call.method).toBe("PUT");
    expect(call.body).toEqual({
      attributes: { EMAIL: "neu@test.ch", VORNAME: "Anna", SPRACHE: "de" },
      listIds: [7],
    });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("creates the contact with the user id when none exists yet", async () => {
    respondWith(404);
    await loadBrevo().upsertNewsletterContact(contact);

    expect(createContact).toHaveBeenCalledTimes(1);
    expect(createContact.mock.calls[0][0]).toEqual(
      expect.objectContaining({ email: "neu@test.ch", extId: "user-1", listIds: [7], updateEnabled: true })
    );
  });

  it("subscribes an address that already belongs to another contact and unlinks the old one", async () => {
    respondWith(400, 204);
    await loadBrevo().upsertNewsletterContact(contact);

    expect(createContact).toHaveBeenCalledTimes(1);
    expect(createContact.mock.calls[0][0].extId).toBeUndefined();
    expect(fetchCall(1).body).toEqual({ unlinkListIds: [7] });
  });

  it("does nothing without Brevo configuration", async () => {
    respondWith();
    await loadBrevo(false).upsertNewsletterContact(contact);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createContact).not.toHaveBeenCalled();
  });
});

describe("removeNewsletterContact", () => {
  it("unlinks the contact by user id and the address itself from the list", async () => {
    respondWith(204);
    await loadBrevo().removeNewsletterContact({ userId: "user-1", email: "neu@test.ch" });

    expect(fetchCall(0).body).toEqual({ unlinkListIds: [7] });
    expect(removeContactFromList).toHaveBeenCalledWith(7, expect.objectContaining({ emails: ["neu@test.ch"] }));
  });
});
