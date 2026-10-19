import Database from "better-sqlite3";
import path from "node:path";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Collects CSP violations and uncaught errors on a page. */
export function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) {
      problems.push(`csp: ${m.text()}`);
    }
  });
  return problems;
}

/** A calculator text field by its exact label (help buttons share the label text). */
export const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

/** A step of Avaliar anúncio, by its heading. */
export const step = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

/** Step 1 by hand: a T2 of 80 m² in Cascais, asking 400 000 €, optionally with a map link. */
export async function fillPropertyByHand(page: Page, askingPrice = "400000", mapsUrl?: string) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Preencher manualmente" }).click();
  await page.getByLabel("Distrito").selectOption({ label: "Lisboa" });
  await page.getByLabel("Concelho").selectOption({ label: "Cascais" });
  await page.getByLabel("Freguesia").selectOption({ index: 1 });
  await field(page, "Preço pedido").fill(askingPrice);
  await field(page, "Área útil").fill("80");
  await page.getByLabel("Tipologia").selectOption({ label: "T2" });
  if (mapsUrl) await page.getByLabel("Link do Google Maps (opcional)").fill(mapsUrl);
  await page.getByRole("button", { name: "Continuar" }).click();
}

/** Step 2: ticks the deals and continues to the shared details panel. */
export async function chooseDeals(page: Page, ...names: string[]) {
  for (const name of names) {
    await page.getByRole("checkbox", { name: new RegExp(`^${name}`) }).click();
  }
  await step(page, "Tipo de negócio").getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: /^1 de \d+: / })).toBeVisible();
}

/** Step 3: moves to the next details panel. */
export async function nextPanel(page: Page) {
  await page.getByRole("button", { name: "Seguinte" }).click();
}

/** Step 3 for a long-term rental: 1 600 €/month on a property worth 440 000 €. */
export async function fillRental(page: Page) {
  await field(page, "Renda mensal esperada").fill("1600");
  await field(page, "Valor de mercado atual").fill("440000");
}

export async function showResults(page: Page) {
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await expect(step(page, "Resultados").getByRole("term").first()).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Signs in from the sign-in page with a magic link read from the dev server's log (emails are
 * logged when no email provider is configured).
 */
export async function signInWithLink(page: Page, email: string, log: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page).toHaveURL(/\/entrar\/verificar/);
  let link: string | undefined;
  await expect
    .poll(() => {
      link = [
        ...readFileSync(log, "utf8").matchAll(/https?:\/\/\S+\/api\/auth\/callback\/resend\?\S+/g),
      ]
        .map((m) => m[0])
        .filter((l) => l.includes(encodeURIComponent(email)))
        .at(-1);
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link!);
  await completeProfileIfAsked(page);
}

/** After the first sign-in the profile is asked for (issue #7): the name alone is enough. */
export async function completeProfileIfAsked(page: Page) {
  await page.waitForURL((url) => !url.pathname.includes("/api/auth"));
  if (!/\/conta\/perfil/.test(page.url())) return;
  await page.getByLabel("Nome").fill("Teste E2E");
  await page.getByRole("button", { name: "Guardar e continuar" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/conta/perfil"));
}

/**
 * From the results: save the scenario as a paid user. Signed out, saving asks to sign in; back
 * on the free plan, the save is refused (issue #5) until the account is moved to the paid plan.
 */
export async function saveSignedIn(page: Page, email: string, log: string) {
  const bar = page.getByRole("region", { name: "Guardar cenário" });
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await bar.getByRole("link", { name: "Entrar →" }).click();
  await signInWithLink(page, email, log);
  await expect(bar.getByText("Guardar cenários faz parte do plano pago.")).toBeVisible();
  setPlan(email, "premium");
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(/cenario=\d+/);
}

/** Opens the database the dev server uses, for a test to set things up directly. */
function openDb() {
  return new Database(
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "../../data/observatorio-habitacao.db"),
  );
}

/** Moves an account to a plan (an admin does this until payments exist). */
export function setPlan(email: string, plan: "free" | "premium") {
  const db = openDb();
  try {
    db.prepare("update users set plan = ? where email = ?").run(plan, email);
  } finally {
    db.close();
  }
}

/**
 * Turns a saved scenario's read-only link on, as links made before issue #12 are; the site no
 * longer makes new ones. Returns the link's token.
 */
export function shareInDb(scenarioId: number | string, photos = false): string {
  const token = randomBytes(12).toString("base64url");
  const db = openDb();
  try {
    db.prepare("update scenarios set share_token = ?, share_photos = ? where id = ?").run(
      token,
      photos ? 1 : 0,
      Number(scenarioId),
    );
  } finally {
    db.close();
  }
  return token;
}

/** Downloads the report from a "Partilhar resultados" box: its file name and text by page. */
export async function downloadReport(page: Page, box: Locator) {
  const download = page.waitForEvent("download");
  await box.getByRole("button", { name: "Descarregar PDF" }).click();
  const file = await download;
  const raw = await readFile((await file.path())!);
  return { name: file.suggestedFilename(), raw, texts: await pdfText(raw) };
}

/** The report's watermark when it is made without signing in (issue #12). */
export const WATERMARK = "OBSERVATÓRIO HABITAÇÃO";

/**
 * Clears the rate-limit counters starting with `prefix` (e.g. "contact:") in the database the
 * dev server uses, so tests that send forms can run again on the same day.
 */
export function clearRateLimits(prefix: string) {
  const db = openDb();
  try {
    db.prepare("delete from cache where key like ?").run(`ratelimit:${prefix}%`);
  } finally {
    db.close();
  }
}

/** A PDF's text, page by page, each page's pieces joined by spaces. */
export async function pdfText(pdf: Buffer): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages;
}
