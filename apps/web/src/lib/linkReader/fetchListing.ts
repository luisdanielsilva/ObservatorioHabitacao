import "server-only";

/**
 * Domains whose terms allow OlhoVivo to read a listing page on the user's request
 * (WBS 4.3.4, 10.4). Configured with LINK_READER_ALLOWED_DOMAINS (comma-separated);
 * empty by default, so nothing is fetched until the allow-list is decided.
 */
export function allowedDomains(): string[] {
  return (process.env.LINK_READER_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedHost(hostname: string, domains = allowedDomains()): boolean {
  const host = hostname.toLowerCase();
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "OlhoVivoLinkReader/0.1 (+https://olhovivo.pt)";

export class NotAllowedError extends Error {}

/**
 * Fetches one listing page. Only https URLs on allow-listed domains are fetched, and
 * redirects are followed only within the allow-list, so the server cannot be used to reach
 * arbitrary or internal hosts.
 */
export async function fetchListing(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) throw new NotAllowedError();
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect without location");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return readLimited(response);
  }
  throw new Error("too many redirects");
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
