import i18next, { TFunction } from "i18next";
import { txEmailApi } from "../brevo/brevo";

const SENDER = { email: "noreply@app.coltivio.ch", name: "Coltivio" };

function formatCHF(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "CHF" }).format(cents / 100);
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

function cardLine(label: string, brand: string | null, last4: string | null): string {
  if (!brand || !last4) return "";
  const brandLabel = brand.charAt(0).toUpperCase() + brand.slice(1);
  return `<tr>
    <td style="padding:4px 0;color:#6b7280;font-size:14px;">${label}</td>
    <td style="padding:4px 0;font-size:14px;text-align:right;">${brandLabel} ****${last4}</td>
  </tr>`;
}

function featureList(items: string[]): string {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function baseLayout(subtitle: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:#16a34a;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">Coltivio</p>
          <p style="margin:6px 0 0;font-size:13px;color:#bbf7d0;">${subtitle}</p>
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

function receiptHtml(
  t: TFunction,
  amount: number,
  periodEnd: Date,
  locale: string,
  cardBrand: string | null,
  cardLast4: string | null
): string {
  return `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:14px;">${t("membership_email.product_name")}</td>
          <td style="padding:4px 0;font-size:14px;text-align:right;">${t("membership_email.product_name")}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:14px;">${t("membership_email.valid_until")}</td>
          <td style="padding:4px 0;font-size:14px;text-align:right;">${formatDate(periodEnd, locale)}</td>
        </tr>
        ${cardLine(t("membership_email.payment_method"), cardBrand, cardLast4)}
        <tr><td colspan="2" style="padding:12px 0 4px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
        <tr>
          <td style="padding:4px 0;font-size:15px;font-weight:600;color:#111827;">${t("membership_email.amount")}</td>
          <td style="padding:4px 0;font-size:15px;font-weight:700;color:#16a34a;text-align:right;">${formatCHF(amount, locale)}</td>
        </tr>
      </table>
    </div>`;
}

function welcomeBody(t: TFunction, _locale: string): string {
  const appFeatures = t("membership_email.new.app_features", { returnObjects: true }) as string[];
  const webappFeatures = t("membership_email.new.webapp_features", { returnObjects: true }) as string[];
  return `
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.new.welcome")}</p>

    <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827;">${t("membership_email.new.features_title")}</p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">${t("membership_email.new.app_label")}</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#4b5563;font-size:14px;line-height:1.7;">${featureList(appFeatures)}</ul>
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">${t("membership_email.new.webapp_label")}</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#4b5563;font-size:14px;line-height:1.7;">${featureList(webappFeatures)}</ul>

    <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">${t("membership_email.forum_cta")}</p>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      ${t("membership_email.contact_question")} <a href="mailto:info@coltivio.ch" style="color:#16a34a;text-decoration:none;">info@coltivio.ch</a>.
      ${t("membership_email.contact_newsletter")} <a href="https://coltivio.ch" style="color:#16a34a;text-decoration:none;">coltivio.ch</a>.
    </p>`;
}

export type MembershipEmailParams = {
  email: string;
  fullName: string | null;
  locale: string;
  amount: number;
  periodEnd: Date;
  cardBrand: string | null;
  cardLast4: string | null;
  // When set, shows trial billing info instead of a receipt
  trialEnd?: Date;
};

export async function sendNewMembershipEmail(params: MembershipEmailParams): Promise<void> {
  const { email, fullName, locale, amount, periodEnd, cardBrand, cardLast4, trialEnd } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;
  const isTrial = trialEnd !== undefined;

  const bottomBlock = isTrial
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-top:24px;">
        <p style="margin:0;font-size:14px;color:#15803d;line-height:1.6;">
          ${t("membership_email.new.trial_billing_info", { date: formatDate(trialEnd, locale) })}
        </p>
      </div>`
    : `<p style="margin:24px 0 10px;font-size:14px;font-weight:600;color:#111827;">${t("membership_email.new.receipt_title")}</p>
       ${receiptHtml(t, amount, periodEnd, locale, cardBrand, cardLast4)}`;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.new.greeting", { name })}</h1>
    ${welcomeBody(t, locale)}
    ${bottomBlock}
  `
  );

  const subject = isTrial ? t("membership_email.new.subject_trial") : t("membership_email.new.subject");

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject,
    htmlContent: html,
    textContent: [
      t("membership_email.new.greeting", { name }),
      "",
      t("membership_email.new.welcome"),
      "",
      isTrial
        ? t("membership_email.new.trial_billing_info", { date: formatDate(trialEnd, locale) })
        : `${t("membership_email.valid_until")}: ${formatDate(periodEnd, locale)}\n${t("membership_email.amount")}: ${formatCHF(amount, locale)}`,
    ].join("\n"),
  });
}

export async function sendFirstPaymentEmail(params: MembershipEmailParams): Promise<void> {
  const { email, fullName, locale, amount, periodEnd, cardBrand, cardLast4 } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.first_payment.greeting", { name })}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.first_payment.intro")}</p>
    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#111827;">${t("membership_email.first_payment.receipt_title")}</p>
    ${receiptHtml(t, amount, periodEnd, locale, cardBrand, cardLast4)}
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.first_payment.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.first_payment.greeting", { name }),
      "",
      t("membership_email.first_payment.intro"),
      "",
      `${t("membership_email.valid_until")}: ${formatDate(periodEnd, locale)}`,
      `${t("membership_email.amount")}: ${formatCHF(amount, locale)}`,
    ].join("\n"),
  });
}

export async function sendRenewalEmail(params: MembershipEmailParams): Promise<void> {
  const { email, fullName, locale, amount, periodEnd, cardBrand, cardLast4 } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.renewal.greeting", { name })}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.renewal.intro")}</p>
    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#111827;">${t("membership_email.renewal.receipt_title")}</p>
    ${receiptHtml(t, amount, periodEnd, locale, cardBrand, cardLast4)}
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.renewal.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.renewal.greeting", { name }),
      "",
      t("membership_email.renewal.intro"),
      "",
      `${t("membership_email.valid_until")}: ${formatDate(periodEnd, locale)}`,
      `${t("membership_email.amount")}: ${formatCHF(amount, locale)}`,
    ].join("\n"),
  });
}

export type ReactivationEmailParams = {
  email: string;
  fullName: string | null;
  locale: string;
  periodEnd: Date;
};

export type ExpiryEmailParams = {
  email: string;
  fullName: string | null;
  locale: string;
  periodEnd: Date;
  renewUrl: string;
};

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">${label}</a>`;
}

export async function sendPaymentFailedEmail(params: ExpiryEmailParams): Promise<void> {
  const { email, fullName, locale, periodEnd, renewUrl } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.payment_failed.greeting", { name })}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.payment_failed.intro", { date: formatDate(periodEnd, locale) })}</p>
    ${ctaButton(renewUrl, t("membership_email.payment_failed.cta"))}
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.payment_failed.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.payment_failed.greeting", { name }),
      "",
      t("membership_email.payment_failed.intro", { date: formatDate(periodEnd, locale) }),
      "",
      renewUrl,
    ].join("\n"),
  });
}

export async function sendExpiryReminderEmail(params: ExpiryEmailParams): Promise<void> {
  const { email, fullName, locale, periodEnd, renewUrl } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.expiry_reminder.greeting", { name })}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.expiry_reminder.intro", { date: formatDate(periodEnd, locale) })}</p>
    ${ctaButton(renewUrl, t("membership_email.expiry_reminder.cta"))}
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.expiry_reminder.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.expiry_reminder.greeting", { name }),
      "",
      t("membership_email.expiry_reminder.intro", { date: formatDate(periodEnd, locale) }),
      "",
      renewUrl,
    ].join("\n"),
  });
}

export async function sendAccessLostEmail(params: ExpiryEmailParams): Promise<void> {
  const { email, fullName, locale, periodEnd, renewUrl } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.access_lost.greeting", { name })}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.access_lost.intro", { date: formatDate(periodEnd, locale) })}</p>
    ${ctaButton(renewUrl, t("membership_email.access_lost.cta"))}
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.access_lost.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.access_lost.greeting", { name }),
      "",
      t("membership_email.access_lost.intro", { date: formatDate(periodEnd, locale) }),
      "",
      renewUrl,
    ].join("\n"),
  });
}

export async function sendMembershipEndedEmail(params: ExpiryEmailParams): Promise<void> {
  const { email, fullName, locale, periodEnd: _periodEnd, renewUrl } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.membership_ended.greeting", { name })}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.membership_ended.intro")}</p>
    <a href="${renewUrl}" style="font-size:14px;color:#16a34a;text-decoration:underline;">${t("membership_email.membership_ended.cta")}</a>
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.membership_ended.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.membership_ended.greeting", { name }),
      "",
      t("membership_email.membership_ended.intro"),
      "",
      renewUrl,
    ].join("\n"),
  });
}

export type CancellationEmailParams = {
  email: string;
  fullName: string | null;
  locale: string;
  periodEnd: Date;
  reactivateUrl: string;
};

export async function sendCancellationEmail(params: CancellationEmailParams): Promise<void> {
  const { email, fullName, locale, periodEnd, reactivateUrl } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.cancellation.greeting", { name })}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">${t("membership_email.cancellation.intro", { date: formatDate(periodEnd, locale) })}</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">${t("membership_email.cancellation.reactivate_hint")}</p>
    ${ctaButton(reactivateUrl, t("membership_email.cancellation.cta"))}
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.cancellation.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.cancellation.greeting", { name }),
      "",
      t("membership_email.cancellation.intro", { date: formatDate(periodEnd, locale) }),
      "",
      t("membership_email.cancellation.reactivate_hint"),
      "",
      reactivateUrl,
    ].join("\n"),
  });
}

export async function sendReactivationEmail(params: ReactivationEmailParams): Promise<void> {
  const { email, fullName, locale, periodEnd } = params;
  const t = i18next.getFixedT(locale);
  const name = fullName ?? email;

  const html = baseLayout(
    t("membership_email.subtitle"),
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">${t("membership_email.reactivation.greeting", { name })}</h1>
    <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
      ${t("membership_email.reactivation.intro", { date: formatDate(periodEnd, locale) })}
    </p>
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject: t("membership_email.reactivation.subject"),
    htmlContent: html,
    textContent: [
      t("membership_email.reactivation.greeting", { name }),
      "",
      t("membership_email.reactivation.intro", { date: formatDate(periodEnd, locale) }),
    ].join("\n"),
  });
}
