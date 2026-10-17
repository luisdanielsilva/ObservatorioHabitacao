import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension. "/" on its own:
  // under a base path the home page ("/observatorio-habitacao") does not match the pattern.
  matcher: ["/", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
