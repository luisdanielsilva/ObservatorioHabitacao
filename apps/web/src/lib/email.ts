import "server-only";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Where replies go, e.g. the person who wrote through the contact form. */
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}

/**
 * Sends a transactional email through Resend (WBS 3.3.4) when RESEND_API_KEY is set.
 * Without a key (development), the email is written to the server log instead.
 */
export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(
      `[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}` +
        (email.attachments?.length ? `\n(${email.attachments.length} attachment(s))` : ""),
    );
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Observatório Habitação <noreply@observatoriohabitacao.pt>",
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      reply_to: email.replyTo,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
  });
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${await response.text()}`);
}

/** Escapes text for use in email HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
