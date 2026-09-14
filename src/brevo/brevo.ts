import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
  ContactsApi,
  ContactsApiApiKeys,
  CreateContact,
  RemoveContactFromList,
} from "@getbrevo/brevo";

const API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = "https://api.brevo.com/v3";

const _txEmailApi = new TransactionalEmailsApi();
if (API_KEY) {
  _txEmailApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, API_KEY);
}

export const txEmailApi = {
  sendTransacEmail(email: SendSmtpEmail) {
    if (!API_KEY) {
      console.log("[brevo] BREVO_API_KEY not set, skipping email:", JSON.stringify(email, null, 2));
      return Promise.resolve();
    }
    return _txEmailApi.sendTransacEmail(email);
  },
};

const _contactsApi = new ContactsApi();
if (API_KEY) {
  _contactsApi.setApiKey(ContactsApiApiKeys.apiKey, API_KEY);
}

const LIST_ID = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

export type NewsletterContact = {
  userId: string;
  email: string;
  firstName: string | null;
  locale: string;
};

// Keyed by user id (ext_id) so an address change keeps the contact, its list and its unsubscribe status.
// The SDK cannot address contacts by ext_id.
function updateContactByUserId(userId: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BREVO_API_URL}/contacts/${encodeURIComponent(userId)}?identifierType=ext_id`, {
    method: "PUT",
    headers: { "api-key": API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

async function createListContact(contact: NewsletterContact, withUserId: boolean): Promise<void> {
  const payload = new CreateContact();
  payload.email = contact.email;
  if (withUserId) {
    payload.extId = contact.userId;
  }
  payload.attributes = {
    VORNAME: contact.firstName ?? "",
    SPRACHE: contact.locale,
    QUELLE: "app",
  };
  payload.listIds = [LIST_ID!];
  payload.updateEnabled = true;
  await _contactsApi.createContact(payload);
}

export async function upsertNewsletterContact(contact: NewsletterContact): Promise<void> {
  if (!API_KEY || LIST_ID === undefined) {
    console.log("[brevo] contact sync skipped (no API key or BREVO_LIST_ID):", contact.email);
    return;
  }

  try {
    const res = await updateContactByUserId(contact.userId, {
      attributes: { EMAIL: contact.email, VORNAME: contact.firstName ?? "", SPRACHE: contact.locale },
      listIds: [LIST_ID],
    });
    if (res.ok) return;

    if (res.status === 404) {
      // updateEnabled attaches the user id to an address already subscribed through the landing page
      await createListContact(contact, true);
      return;
    }

    if (res.status === 400) {
      // Usually the new address already exists as a separate contact
      console.warn(
        "[brevo] contact update rejected, subscribing the address separately",
        contact.email,
        await res.text()
      );
      await createListContact(contact, false);
      await updateContactByUserId(contact.userId, { unlinkListIds: [LIST_ID] });
      return;
    }

    console.error("[brevo] failed to update contact", contact.email, res.status, await res.text());
  } catch (error) {
    console.error("[brevo] failed to upsert contact", contact.email, error);
  }
}

export async function removeNewsletterContact(contact: { userId: string; email: string }): Promise<void> {
  if (!API_KEY || LIST_ID === undefined) {
    console.log("[brevo] contact removal skipped (no API key or BREVO_LIST_ID):", contact.email);
    return;
  }

  try {
    const res = await updateContactByUserId(contact.userId, { unlinkListIds: [LIST_ID] });
    if (!res.ok && res.status !== 404) {
      console.error("[brevo] failed to unlink contact", contact.email, res.status, await res.text());
    }
  } catch (error) {
    console.error("[brevo] failed to unlink contact", contact.email, error);
  }

  // Addresses subscribed through the landing page or the duplicate fallback carry no user id
  const payload = new RemoveContactFromList();
  payload.emails = [contact.email];
  try {
    await _contactsApi.removeContactFromList(LIST_ID, payload);
  } catch {
    // not on the list
  }
}
