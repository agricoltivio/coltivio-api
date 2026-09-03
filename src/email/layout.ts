// Shared HTML shell for all transactional emails sent through Brevo.
// Extracted from membership.email.ts so verification and welcome mails look identical.

export function baseLayout(subtitle: string, content: string): string {
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

export function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">${label}</a>`;
}
