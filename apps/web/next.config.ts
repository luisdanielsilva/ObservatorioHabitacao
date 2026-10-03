import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Workspace packages are published as TypeScript source.
  transpilePackages: ["@olhovivo/engine", "@olhovivo/db"],
  serverExternalPackages: ["better-sqlite3"],
};

export default createNextIntlPlugin()(nextConfig);
