import { expect, test, type Page } from "@playwright/test";
import {
  clearRateLimits,
  downloadReport,
  expectNoHorizontalScroll,
  field,
  setPlan,
  signInWithLink,
  step,
  watchProblems,
  WATERMARK,
} from "./helpers";

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

test("vender: the PDF, watermarked signed out; saved to the account on the paid plan", async ({
  page,
}) => {
  test.skip(!LOG, "needs E2E_SERVER_LOG for the sign-in link");
  const email = `e2e+sell${Date.now()}@example.pt`;
  clearRateLimits("report-pdf:");
  await fillProperty(page);
  await addListings(page);
  await step(page, "A venda").getByRole("button", { name: "Saltar" }).click();

  // Signed out, the report can be downloaded, with the watermark (issue #12).
  const result = step(page, "Resultado");
  const share = result.getByRole("region", { name: "Partilhar resultados" });
  const anonymous = await downloadReport(page, share);
  expect(anonymous.name).toBe("observatorio-habitacao-apartamento-t2-em-arroios.pdf");
  for (const text of anonymous.texts) expect(text).toContain(WATERMARK);

  // Saving asks to sign in; back on the free plan it is refused: it is part of the paid plan.
  const bar = page.getByRole("region", { name: "Guardar avaliação" });
  await expect(bar.getByText("Plano pago")).toBeVisible();
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await bar.getByRole("link", { name: "Entrar →" }).click();
  await signInWithLink(page, email, LOG!);
  await expect(bar.getByText("Guardar avaliações faz parte do plano pago.")).toBeVisible();
  // Signed in, the report is clean and names who made it.
  const clean = await downloadReport(page, share);
  expect(clean.texts[0]).toContain(`por Teste E2E · ${email}`);
  expect(clean.texts.join(" ")).not.toContain(WATERMARK);

  // On the paid plan it is saved, listed in the account and opened again at its result.
  setPlan(email, "premium");
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(/avaliacao=\d+/);
  await page.goto("/conta");
  const saved = page.getByRole("link", { name: "Apartamento T2 em Arroios" });
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(step(page, "Resultado").getByText("Valor provável")).toBeVisible();
  await expect(page.getByRole("button", { name: "Descarregar PDF" })).toBeVisible();
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
