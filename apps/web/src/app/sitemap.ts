import { getAreaTree, type AreaNode } from "@observatorio-habitacao/db";
import type { MetadataRoute } from "next";
import { localizedUrl } from "@/lib/urls";
import { getDb } from "@/lib/db";
import { FEATURES } from "@/lib/features";

// Rebuilt at most once a day, so new areas from the CAOP import appear without a deploy.
export const revalidate = 86400;

const STATIC_PATHS = [
  "/",
  "/avaliar",
  ...(FEATURES.prices ? ["/precos"] : []),
  ...(FEATURES.sell ? ["/vender"] : []),
  "/sobre",
  "/metodologia",
  "/contactos",
  "/privacidade",
  "/termos",
  "/cookies",
];

/** One entry per locale, each pointing at both language versions. */
function entries(pathname: string, priority: number): MetadataRoute.Sitemap {
  const languages = { "pt-PT": localizedUrl("pt", pathname), en: localizedUrl("en", pathname) };
  return (["pt", "en"] as const).map((locale) => ({
    url: localizedUrl(locale, pathname),
    changeFrequency: pathname.startsWith("/precos") ? "monthly" : "weekly",
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const areas: string[] = [];
  const walk = (nodes: AreaNode[]) =>
    nodes.forEach((n) => {
      areas.push(n.path);
      walk(n.children);
    });
  if (FEATURES.prices) walk(getAreaTree(getDb()));

  return [
    ...STATIC_PATHS.flatMap((p) => entries(p, p === "/" ? 1 : 0.7)),
    ...areas.flatMap((path) => entries(`/precos/${path}`, 0.5)),
  ];
}
