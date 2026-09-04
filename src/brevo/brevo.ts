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
  email: string;
  firstName: string | null;
  locale: string;
};

export async function upsertNewsletterContact(contact: NewsletterContact): Promise<void> {
  if (!API_KEY || LIST_ID === undefined) {
    console.log("[brevo] contact sync skipped (no API key or BREVO_LIST_ID):", contact.email);
    return;
  }
  const payload = new CreateContact();
  payload.email = contact.email;
  payload.attributes = {
    VORNAME: contact.firstName ?? "",
    SPRACHE: contact.locale,
    QUELLE: "app",
  };
  payload.listIds = [LIST_ID];
  payload.updateEnabled = true;

  try {
    await _contactsApi.createContact(payload);
  } catch (error) {
    console.error("[brevo] failed to upsert contact", contact.email, error);
  }
}

export async function removeNewsletterContact(email: string): Promise<void> {
  if (!API_KEY || LIST_ID === undefined) {
    console.log("[brevo] contact removal skipped (no API key or BREVO_LIST_ID):", email);
    return;
  }
  const payload = new RemoveContactFromList();
  payload.emails = [email];

  try {
    await _contactsApi.removeContactFromList(LIST_ID, payload);
  } catch (error) {
    console.error("[brevo] failed to remove contact", email, error);
  }
}
