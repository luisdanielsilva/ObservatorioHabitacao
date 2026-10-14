import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { BASE_PATH } from "@/lib/basePath";

type Handler = (request: NextRequest) => Promise<Response>;

/**
 * Behind a shared domain, the address Auth.js sees and builds its links from must be the
 * public one. Next.js removes the base path from a route's request address, but Auth.js
 * matches the full one (its basePath includes the site's base path): put it back, with the
 * host and protocol the proxy forwards (trustHost).
 */
const withBase =
  (handler: Handler): Handler =>
  (request) => {
    if (!BASE_PATH) return handler(request);
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${BASE_PATH}/`)) url.pathname = `${BASE_PATH}${url.pathname}`;
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "https" || proto === "http") url.protocol = `${proto}:`;
    // Setting only the host would keep the internal port.
    const address = host ? new URL(`${url.protocol}//${host}${url.pathname}${url.search}`) : url;
    return handler(new NextRequest(address, request));
  };

export const GET = withBase(handlers.GET);
export const POST = withBase(handlers.POST);
