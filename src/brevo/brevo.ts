import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
  SendSmtpEmail,
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
