import { txEmailApi } from "../brevo/brevo";

export async function sendFarmInviteEmail(
  email: string,
  code: string,
  farmName: string,
) {
  if (process.env.NODE_ENV !== "production") return;
  await txEmailApi.sendTransacEmail({
    to: [{ email }],
    sender: { email: process.env.BREVO_SENDER_EMAIL!, name: "Coltivio" },
    subject: `You've been invited to join ${farmName} on Coltivio`,
    textContent: `Your invite code: ${code}\n\nThis code expires in 7 days.`,
    htmlContent: `<p>You've been invited to join <strong>${farmName}</strong> on Coltivio.</p><p>Your invite code: <strong>${code}</strong></p><p>This code expires in 7 days.</p>`,
  });
}
