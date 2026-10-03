/**
 * The built-in PDF fonts cover Latin-1 and the euro sign. Intl uses narrow no-break spaces and
 * a few other characters outside it, which are mapped to safe equivalents here.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[\u202f\u2009]/g, "\u00a0")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\u2248/g, "~")
    .replace(/\u2192/g, "->")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\u0000-\u00ff\u20ac]/g, "");
}

/** "Apartamento T2 em Arroios" -> "olhovivo-apartamento-t2-em-arroios.pdf". */
export function reportFilename(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `olhovivo-${slug || "cenario"}.pdf`;
}
