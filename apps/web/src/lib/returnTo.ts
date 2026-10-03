/** Only same-site paths are accepted as the page to return to after signing in. */
export function safeReturnTo(value: unknown, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}
