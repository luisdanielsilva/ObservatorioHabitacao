/**
 * The path the site is served under, e.g. "/observatorio-habitacao" behind a shared domain; ""
 * at the root.
 * Set at build time (NEXT_PUBLIC_BASE_PATH, also next.config's basePath). next/link, the router
 * and redirects add it themselves; plain links, fetch calls and Auth.js need withBasePath.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** An app path ("/api/…", "/partilha/…") as the browser must request it. */
export function withBasePath(path: string): string {
  return path === "/" ? BASE_PATH || "/" : `${BASE_PATH}${path}`;
}
