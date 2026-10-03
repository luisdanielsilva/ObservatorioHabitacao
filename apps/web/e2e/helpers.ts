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

/** Fills the calculator with a Cascais example that produces all four scenarios. */
export async function fillCalculatorExample(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Distrito").selectOption({ label: "Lisboa" });
  await page.getByLabel("Concelho").selectOption({ label: "Cascais" });
  await page.getByLabel("Freguesia").selectOption({ index: 1 });
  await field(page, "Área útil").fill("80");
  await field(page, "Preço pedido").fill("400000");
  await field(page, "Valor de mercado atual").fill("440000");
  await field(page, "Preço de venda após obras").fill("480000");
  await field(page, "Renda mensal esperada").fill("1600");
  const seasons = page.getByRole("table").filter({ hasText: "Época alta" });
  const values = [
    ["150", "85"],
    ["110", "70"],
    ["80", "50"],
  ];
  for (let i = 0; i < 3; i++) {
    const inputs = seasons
      .getByRole("row")
      .nth(i + 1)
      .getByRole("textbox");
    await inputs.nth(0).fill(values[i]![0]!);
    await inputs.nth(1).fill(values[i]![1]!);
  }
  await field(page, "Sinal pago").fill("40000");
  await field(page, "Preço da cessão").fill("60000");
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
