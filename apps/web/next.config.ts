import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy (WBS 11.6). Scripts need 'unsafe-inline': Next.js and next-themes
 * inject inline scripts, and nonces would make the statically generated pages dynamic.
 * Development also needs eval and a websocket for hot reloading.
 */
const csp = [
  "default-src 'self'",
  // Stripe's embedded checkout for donations (its API is www.singleuseapps.com, in connect-src).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  // Recharts and Radix set inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.stripe.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""} https://www.singleuseapps.com https://*.stripe.com`,
  "frame-src https://*.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  // Google sign-in redirects after the form submission.
  "form-action 'self' https://accounts.google.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Served under a path of a shared domain when set (e.g. "/observatorio-habitacao");
  // see lib/basePath.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || undefined,
  // Workspace packages are published as TypeScript source.
  transpilePackages: ["@observatorio-habitacao/engine", "@observatorio-habitacao/db"],
  // Native or Node-only packages loaded at runtime instead of being bundled.
  serverExternalPackages: ["better-sqlite3", "@react-pdf/renderer"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin()(nextConfig);
