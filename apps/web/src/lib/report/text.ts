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
    .replace(/\u203a/g, ">")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\u0000-\u00ff\u20ac]/g, "");
}

/** "Apartamento T2 em Arroios" -> "observatorio-habitacao-apartamento-t2-em-arroios.pdf". */
export function reportFilename(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `observatorio-habitacao-${slug || "cenario"}.pdf`;
}

/**
 * A chart bar's label on one line, or on two (split at the space nearest the middle) when it
 * would be wider than its slot and run into the next one: with many bars, "IRS mais-valia" did.
 * Widths are estimated for Helvetica, about 0.52 em a character.
 */
export function labelLines(label: string, slot: number, fontSize: number): string[] {
  if (label.length * fontSize * 0.52 <= slot - 2 || !label.includes(" ")) return [label];
  const middle = label.length / 2;
  const at = [...label.matchAll(/ /g)]
    .map((m) => m.index)
    .reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));
  return [label.slice(0, at), label.slice(at + 1)];
}
