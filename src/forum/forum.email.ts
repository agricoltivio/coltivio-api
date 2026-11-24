import i18next from "i18next";
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import { txEmailApi } from "../brevo/brevo";
import { BRAND, baseLayout, ctaButton, escapeHtml } from "../email/layout";

const SENDER = { email: "noreply@app.coltivio.ch", name: "Coltivio" };
const EXCERPT_MAX_LENGTH = 300;

export type ForumNotificationReason = "moderator" | "subscribed";

export type ForumEmailParams = {
  email: string;
  fullName: string | null;
  locale: string;
  kind: "new_thread" | "reply";
  authorName: string | null;
  threadTitle: string;
  excerpt: string;
  threadUrl: string;
  reason: ForumNotificationReason;
};

// Posts are markdown; the mail only needs a plain-text teaser
// Raw HTML on, so its tokens can be dropped instead of showing up as text
const markdownParser = new MarkdownIt({ html: true });

// The text of a Markdown body without its syntax: entities decoded (the editor writes e.g. "&#x20;" for a space at a
// line end), no emphasis, link or heading markers, no images and no raw HTML. Line and block breaks become spaces.
function markdownToPlainText(markdown: string): string {
  const parts: string[] = [];
  const collect = (tokens: Token[]) => {
    for (const token of tokens) {
      if (token.type === "image" || token.type === "html_block") continue;
      // Raw HTML is dropped, a line break in it (<br>) still separates the words around it
      if (token.type === "html_inline") {
        if (/^<br\s*\/?>$/i.test(token.content)) parts.push(" ");
        continue;
      }
      if (
        token.type === "text" ||
        token.type === "code_inline" ||
        token.type === "code_block" ||
        token.type === "fence"
      ) {
        parts.push(token.content);
      } else if (token.type === "softbreak" || token.type === "hardbreak" || (token.block && token.nesting === -1)) {
        // Only block endings (paragraph, list item, heading, table cell) separate text; inline ones (strong, em,
        // link) don't, so "**Bio**dünger" stays one word
        parts.push(" ");
      }
      if (token.children) collect(token.children);
    }
  };
  collect(markdownParser.parse(markdown, {}));
  return parts.join("");
}

export function toExcerpt(body: string): string {
  const flat = markdownToPlainText(body).replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_MAX_LENGTH ? `${flat.slice(0, EXCERPT_MAX_LENGTH).trimEnd()}…` : flat;
}

export async function sendForumNotificationEmail(params: ForumEmailParams): Promise<void> {
  const { email, fullName, locale, kind, authorName, threadTitle, excerpt, threadUrl, reason } = params;
  const t = i18next.getFixedT(locale);

  // Raw values here; the HTML variant escapes once via escapeHtml, the text variant must stay unescaped
  const raw = { interpolation: { escapeValue: false } };
  const subject = t(`forum_email.${kind}_subject`, { title: threadTitle, ...raw });
  const intro = t(`forum_email.${kind}_intro`, { author: authorName || t("forum_email.unknown_author"), ...raw });
  const reasonText = t(`forum_email.reason_${reason}`);

  const html = baseLayout(
    t("forum_email.subtitle"),
    `
    <p style="margin:0 0 8px;font-size:15px;color:${BRAND.text};line-height:1.65;">${escapeHtml(intro)}</p>
    <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:${BRAND.text};">${escapeHtml(threadTitle)}</h1>
    ${
      excerpt
        ? `<div style="background:${BRAND.accent};border:1px solid ${BRAND.border};border-left:3px solid ${BRAND.sage};border-radius:6px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:14px;color:${BRAND.text};line-height:1.7;white-space:pre-wrap;">${escapeHtml(excerpt)}</p>
    </div>`
        : ""
    }
    ${ctaButton(threadUrl, t("forum_email.cta"))}
    <p style="margin:28px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.6;">${escapeHtml(reasonText)}</p>
  `
  );

  await txEmailApi.sendTransacEmail({
    to: [{ email, name: fullName ?? undefined }],
    sender: SENDER,
    subject,
    htmlContent: html,
    textContent: [intro, threadTitle, "", ...(excerpt ? [excerpt, ""] : []), threadUrl, "", reasonText].join("\n"),
  });
}
