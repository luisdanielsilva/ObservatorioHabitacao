import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { ingestionJobs, sources } from "../schema";

export interface ImportCounts {
  seen: number;
  new: number;
  updated: number;
}

/** Public data sources, created on first use. */
export const PUBLIC_SOURCES = {
  caop: { name: "DGT — CAOP", baseUrl: "https://www.dgterritorio.gov.pt/" },
  ine: { name: "INE", baseUrl: "https://www.ine.pt/" },
  ecb: { name: "ECB Data Portal", baseUrl: "https://data.ecb.europa.eu/" },
  imi: { name: "IMI rates (AT via flatin.pt, CC BY 4.0)", baseUrl: "https://flatin.pt/" },
  dre: {
    name: "Diário da República — coeficientes de atualização de rendas (INE)",
    baseUrl: "https://diariodarepublica.pt/",
  },
  rnal: {
    name: "Turismo de Portugal — RNAL",
    baseUrl: "https://dadosabertos.turismodeportugal.pt/",
  },
} as const;

function sourceId(db: Db, key: keyof typeof PUBLIC_SOURCES): number {
  const { name, baseUrl } = PUBLIC_SOURCES[key];
  const existing = db.select({ id: sources.id }).from(sources).where(eq(sources.name, name)).get();
  if (existing) return existing.id;
  return db
    .insert(sources)
    .values({ name, kind: "public", baseUrl, permitted: true })
    .returning({ id: sources.id })
    .get().id;
}

/** Runs an import and records it in `ingestion_jobs` (status, counts, error). */
export async function runImport(
  db: Db,
  source: keyof typeof PUBLIC_SOURCES,
  kind: string,
  task: () => Promise<ImportCounts>,
): Promise<ImportCounts> {
  const job = db
    .insert(ingestionJobs)
    .values({
      sourceId: sourceId(db, source),
      kind,
      status: "running",
      startedAt: new Date().toISOString(),
    })
    .returning({ id: ingestionJobs.id })
    .get();
  try {
    const counts = await task();
    db.update(ingestionJobs)
      .set({
        status: "succeeded",
        finishedAt: new Date().toISOString(),
        itemsSeen: counts.seen,
        itemsNew: counts.new,
        itemsUpdated: counts.updated,
      })
      .where(eq(ingestionJobs.id, job.id))
      .run();
    return counts;
  } catch (error) {
    db.update(ingestionJobs)
      .set({
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      })
      .where(eq(ingestionJobs.id, job.id))
      .run();
    throw error;
  }
}
