import i18next from "i18next";
import { txEmailApi } from "../brevo/brevo";

const SENDER = { email: "noreply@app.coltivio.ch", name: "Coltivio" };

function formatCHF(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "CHF" }).format(cents / 100);
}

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:#16a34a;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">AgriColtivio</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:36px 40px;">${content}</td></tr>
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Verein AgriColtivio · Schweiz</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">
            <a href="mailto:info@coltivio.ch" style="color:#16a34a;text-decoration:none;">info@coltivio.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type DonationEmailParams = {
  email: string;
  fullName: string | null;
  locale: string;
  amount: number;
};

export async function sendDonationConfirmationEmail(params: DonationEmailParams): Promise<void> {
  const { email, fullName, locale, amount } = params;
  const t = i18next.getFixedT(locale);

  const greeting = fullName ? t("donation_email.greeting", { name: fullName }) : t("donation_email.greeting_anonymous");

  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">${greeting}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("donation_email.intro")}</p>

    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#111827;">${t("donation_email.receipt_title")}</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:14px;">${t("donation_email.product_name")}</td>
          <td style="padding:4px 0;font-size:14px;text-align:right;">Coltivio</td>
        </tr>
        <tr><td colspan="2" style="padding:12px 0 4px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
        <tr>
          <td style="padding:4px 0;font-size:15px;font-weight:600;color:#111827;">${t("donation_email.amount")}</td>
          <td style="padding:4px 0;font-size:15px;font-weight:700;color:#16a34a;text-align:right;">${formatCHF(amount, locale)}</td>
        </tr>
      </table>
    </div>
  `);

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("donation_email.subject"),
    htmlContent: html,
    textContent: [
      greeting,
      "",
      t("donation_email.intro"),
      "",
      `${t("donation_email.amount")}: ${formatCHF(amount, locale)}`,
    ].join("\n"),
  });
}
