import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

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
}

/** From the results: save the scenario, signing in when asked. */
export async function saveSignedIn(page: Page, email: string, log: string) {
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("link", { name: "Guardar →" }).click();
  await signInWithLink(page, email, log);
  await expect(page).toHaveURL(/cenario=\d+/);
}
