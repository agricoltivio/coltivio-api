import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from "@getbrevo/brevo";

const API_KEY = process.env.BREVO_API_KEY;

export const txEmailApi = new TransactionalEmailsApi();
txEmailApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, API_KEY!);
