import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, field, signInWithLink, step, watchProblems } from "./helpers";

const LOG = process.env.E2E_SERVER_LOG;

/** Step 1: a T2 of 100 m² in Arroios, 3rd floor without a lift, with garage and balcony. */
async function fillProperty(page: Page) {
  await page.goto("/vender");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Distrito").selectOption({ label: "Lisboa" });
  await page.getByLabel("Concelho").selectOption({ label: "Lisboa" });
  await page.getByLabel("Freguesia").selectOption({ label: "Arroios" });
  await field(page, "Área útil").fill("100");
  await page.getByLabel("Tipologia").selectOption({ label: "T2" });
  await page.getByLabel("Andar").selectOption({ label: "3.º andar" });
  await page.getByLabel("Garagem").check();
  await page.getByLabel("Varanda").check();
  await page.getByRole("button", { name: "Continuar" }).click();
}

/** Step 2: three similar listings by hand, the last one on the 4th floor without a lift. */
async function addListings(page: Page) {
  const comparables = step(page, "Anúncios semelhantes");
  for (const [price, area] of [
    ["420000", "100"],
    ["390000", "95"],
    ["450000", "110"],
  ] as const) {
    await comparables.getByRole("button", { name: "Adicionar à mão" }).click();
    await field(page, "Preço pedido").fill(price);
    await comparables.getByRole("textbox", { name: "Área útil", exact: true }).fill(area);
  }
  await comparables.getByLabel("Andar").selectOption({ label: "4.º andar" });
  await comparables.getByLabel("Elevador").selectOption({ label: "Não" });
  await expect(comparables.getByText("4.º andar · sem elevador")).toBeVisible();
  await comparables.getByRole("button", { name: "Continuar", exact: true }).click();
}

test("vender: value from the INE median and similar listings, asking price, what the seller keeps", async ({
  page,
}) => {
  const problems = watchProblems(page);
  await fillProperty(page);

  // The floor is required for an apartment; the property's summary shows once done.
  await expect(step(page, "Imóvel")).toContainText("Apartamento T2 · 100 m² · Arroios, Lisboa");
  await addListings(page);

  // Step 3 is optional: skipped, the result has the value but not the proceeds.
  await step(page, "A venda").getByRole("button", { name: "Saltar" }).click();
  const result = step(page, "Resultado");
  await expect(result.getByText("Valor provável")).toBeVisible();
  await expect(result.getByText("Confiança média")).toBeVisible();
  await expect(result.getByText("Preço a pedir sugerido")).toBeVisible();
  await expect(result.getByRole("button", { name: "Indicar dados da venda" })).toBeVisible();

  // How it was worked out: the lift on the 3rd floor lowers this property by 10 %.
  await result.locator("summary", { hasText: "Como calculámos" }).click();
  await expect(result.getByRole("row", { name: /Sem elevador, 3\.º andar/ })).toContainText("-10%");
  await expect(result.getByRole("row", { name: /Semelhante 3/ })).toContainText("sem elevador");

  // With the sale's details: commission, IRS on the gain and the loan.
  await result.getByRole("button", { name: "Indicar dados da venda" }).click();
  await field(page, "Preço de compra").fill("200000");
  await field(page, "Ano de compra").fill("2015");
  await field(page, "Crédito em dívida").fill("100000");
  await page.getByRole("button", { name: "Ver resultado" }).click();
  const proceeds = result.getByRole("region", { name: "Quanto fica para ti" });
  await expect(proceeds.getByRole("row", { name: /Comissão da agência/ }).first()).toBeVisible();
  await expect(proceeds.getByRole("row", { name: /Crédito liquidado/ })).toContainText("100 000 €");
  await expect(proceeds.getByRole("row", { name: /Fica para ti/ })).toBeVisible();
  await proceeds.locator("summary", { hasText: "IRS sobre a mais-valia" }).click();
  await expect(proceeds.getByText(/coeficiente 1,20, Portaria n\.º 382\/2025\/1/)).toBeVisible();

  expect(problems).toEqual([]);
});

test("vender: saved to the account, reopened, with its PDF report", async ({ page }) => {
  test.skip(!LOG, "needs E2E_SERVER_LOG for the sign-in link");
  const email = `e2e+sell${Date.now()}@example.pt`;
  await fillProperty(page);
  await addListings(page);
  await step(page, "A venda").getByRole("button", { name: "Saltar" }).click();

  // Signed out, saving asks to sign in, then comes back to the valuation and saves it.
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("link", { name: "Guardar →" }).click();
  await signInWithLink(page, email, LOG!);
  await expect(page).toHaveURL(/avaliacao=\d+/);
  const pdf = page.getByRole("link", { name: "Ver PDF" });
  await expect(pdf).toBeVisible();
  const href = await pdf.getAttribute("href");
  const response = await page.request.get(href!);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["content-disposition"]).toMatch(
    /^inline; filename="observatorio-habitacao-apartamento-t2-em-arroios\.pdf"$/,
  );

  // Listed in the account, and opened again at its result.
  await page.goto("/conta");
  const saved = page.getByRole("link", { name: "Apartamento T2 em Arroios" });
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(step(page, "Resultado").getByText("Valor provável")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver PDF" })).toBeVisible();
});

test.describe("vender on a phone", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test("no horizontal scroll at the result", async ({ page }) => {
    await fillProperty(page);
    await step(page, "Anúncios semelhantes")
      .getByRole("button", { name: "Continuar sem anúncios" })
      .click();
    await step(page, "A venda").getByRole("button", { name: "Saltar" }).click();
    await expect(step(page, "Resultado").getByText("Valor provável")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
