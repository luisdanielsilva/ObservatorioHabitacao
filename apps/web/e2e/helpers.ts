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

/** Step 1 by hand: a T2 of 80 m² in Cascais, asking 400 000 €. */
export async function fillPropertyByHand(page: Page, askingPrice = "400000") {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Preencher manualmente" }).click();
  await page.getByLabel("Distrito").selectOption({ label: "Lisboa" });
  await page.getByLabel("Concelho").selectOption({ label: "Cascais" });
  await page.getByLabel("Freguesia").selectOption({ index: 1 });
  await field(page, "Preço pedido").fill(askingPrice);
  await field(page, "Área útil").fill("80");
  await page.getByLabel("Tipologia").selectOption({ label: "T2" });
  await page.getByRole("button", { name: "Continuar" }).click();
}

export async function chooseDeal(page: Page, name: string) {
  await page.getByRole("radio", { name: new RegExp(`^${name}`) }).click();
  await expect(
    step(page, "Detalhes do negócio").getByRole("button", { name: "Ver resultados" }),
  ).toBeVisible();
}

/** Step 3 for a long-term rental: 1 600 €/month on a property worth 440 000 €. */
export async function fillRental(page: Page) {
  await field(page, "Renda mensal esperada").fill("1600");
  await field(page, "Valor de mercado atual").fill("440000");
}

export async function showResults(page: Page) {
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await expect(step(page, "Resultados").getByText("Lucro líquido").first()).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
