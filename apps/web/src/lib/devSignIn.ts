import "server-only";

/**
 * Development without an email provider: sign-in links are kept here (as well as written to the
 * server log) so the "check your email" page can show them. Never used in production.
 */
export const DEV_LINK_COOKIE = "observatorio-habitacao-dev-signin-link";

export const showSignInLinks = () =>
  process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY;

// On globalThis: auth and the pages can be bundled separately in development.
const store = globalThis as typeof globalThis & {
  __observatorioHabitacaoSignInLinks?: Map<string, string>;
};
const links = (store.__observatorioHabitacaoSignInLinks ??= new Map());

export function rememberSignInLink(email: string, url: string) {
  if (showSignInLinks()) links.set(email.trim().toLowerCase(), url);
}

/** The last link sent to `email`, once. */
export function takeSignInLink(email: string): string | null {
  const key = email.trim().toLowerCase();
  const url = links.get(key) ?? null;
  links.delete(key);
  return url;
}

// Kept in a cookie as base64url: cookie handling decodes "%2B" in the link to "+", which the
// sign-in callback then reads as a space in the email address.
export const encodeSignInLink = (url: string) => Buffer.from(url).toString("base64url");

export function decodeSignInLink(value: string): string | null {
  const url = Buffer.from(value, "base64url").toString();
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}
