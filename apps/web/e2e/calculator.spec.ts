import { expect, test } from "@playwright/test";
import {
  chooseDeal,
  field,
  fillPropertyByHand,
  fillRental,
  showResults,
  step,
  watchProblems,
} from "./helpers";

test("manual entry: long-term rental, results and comparison", async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto("/avaliar");
  await fillPropertyByHand(page);

  // The property step collapses into a summary; the deal step opens.
  await expect(step(page, "Imóvel")).toContainText("Apartamento T2 · 80 m² · 400 000 €");
  await chooseDeal(page, "Arrendamento de longa duração");
  await fillRental(page);
  await showResults(page);

  const results = step(page, "Resultados");
  await expect(results.getByRole("term").filter({ hasText: "Cash flow mensal" })).toBeVisible();
  // 400 000 asked vs 440 000 market value: 9 % below → opportunity.
  await expect(results.getByText("Oportunidade", { exact: true })).toBeVisible();

  // A large loan triggers a warning in the deal's details.
  await step(page, "Detalhes do negócio").getByRole("button", { name: "Alterar" }).click();
  await field(page, "Montante do empréstimo").fill("390000");
  await showResults(page);
  await expect(
    results.getByText(/excede o limite recomendado pelo Banco de Portugal/),
  ).toBeVisible();

  // The comparison shows all four strategies and offers to fill in the missing ones.
  await results.getByRole("button", { name: "Comparar" }).click();
  const table = results.getByRole("table", { name: "Comparação de cenários" });
  for (const name of ["Revenda", "Arrendamento", "AL", "Cessão"]) {
    await expect(table.getByRole("columnheader", { name: new RegExp(name) })).toBeVisible();
  }
  await table.getByRole("button", { name: "Preencher dados" }).first().click();
  await expect(step(page, "Tipo de negócio")).toContainText("Compra e revenda");
  await field(page, "Preço de venda após obras").fill("480000");
  await showResults(page);
  await expect(results.getByRole("term").filter({ hasText: /^ROI/ })).toBeVisible();

  expect(problems).toEqual([]);
});

test("the property step requires every field", async ({ page }) => {
  await page.goto("/avaliar");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Preencher manualmente" }).click();
  await field(page, "Preço pedido").fill("250000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByText("Indique: tipologia, área útil, localização (pelo menos o concelho)"),
  ).toBeVisible();
  await expect(
    page.getByRole("radiogroup", { name: "Que tipo de negócio quer avaliar?" }),
  ).toHaveCount(0);
});

test("short-term rental and contract position sale", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeal(page, "Alojamento local");
  const seasons = [
    ["Época alta (jun–set)", "150", "85"],
    ["Época média (abr, mai, out)", "110", "70"],
    ["Época baixa (nov–mar)", "80", "50"],
  ];
  for (const [season, rate, occupancy] of seasons) {
    await page.getByRole("textbox", { name: `Preço médio por noite — ${season}` }).fill(rate!);
    await page.getByRole("textbox", { name: `Ocupação — ${season}` }).fill(occupancy!);
  }
  await field(page, "Valor de mercado atual").fill("440000");
  await showResults(page);
  await expect(
    step(page, "Resultados").getByRole("term").filter({ hasText: "Rentabilidade líquida" }),
  ).toBeVisible();

  await step(page, "Tipo de negócio").getByRole("button", { name: "Alterar" }).click();
  await chooseDeal(page, "Cessão de posição contratual");
  await field(page, "Sinal pago").fill("40000");
  await field(page, "Preço da cessão").fill("60000");
  await showResults(page);
  await expect(
    step(page, "Resultados").getByRole("term").filter({ hasText: "Retorno sobre o sinal" }),
  ).toBeVisible();
});

test("sensitivity analysis responds to the slider", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeal(page, "Arrendamento de longa duração");
  await fillRental(page);
  await showResults(page);
  const panel = page.getByRole("region", { name: "Análise de sensibilidade" });
  await panel.getByRole("radio", { name: "Juro" }).click();
  await panel
    .getByRole("combobox", { name: "Indicador", exact: true })
    .selectOption({ label: "Cash flow mensal" });
  await panel.getByRole("slider").fill("0.02");
  await expect(panel.locator("output")).toContainText("+2");
  const rental = panel.getByRole("row", { name: /Arrendamento/ });
  // Higher interest → lower cash flow: the difference is negative.
  await expect(rental.getByRole("cell").last()).toHaveText(/^−/);
});

test("a listing link is read and fills the property (reader mocked)", async ({ page }) => {
  // A real parish id from the reference API, so the location selects can show it.
  const areas = await (await page.request.get("/api/areas")).json();
  const lisboa = areas.find((a: { path: string }) => a.path === "lisboa");
  const cascais = lisboa.children.find((a: { path: string }) => a.path === "lisboa/cascais");
  const parish = cascais.children[0];
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        analysisId: "test",
        areaId: parish.id,
        property: { askingPrice: 320000, propertyType: "apartamento", bedrooms: 3, areaM2: 95 },
      },
    }),
  );
  await page.goto("/avaliar");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("textbox", { name: "Link do anúncio" })
    .fill("https://www.example.pt/imovel/1/");
  await page.getByRole("button", { name: "Ler anúncio" }).click();
  await expect(page.getByText(/Dados lidos do anúncio/)).toBeVisible();
  await expect(field(page, "Preço pedido")).toHaveValue("320000");
  await expect(page.getByLabel("Freguesia")).toHaveValue(String(parish.id));
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(step(page, "Imóvel")).toContainText("Apartamento T3 · 95 m² · 320 000 €");
});

test("the link reader refuses sites that are not allowed", async ({ page }) => {
  await page.goto("/avaliar");
  await page
    .getByRole("textbox", { name: "Link do anúncio" })
    .fill("https://www.idealista.pt/imovel/1/");
  await page.getByRole("button", { name: "Ler anúncio" }).click();
  await expect(page.getByText(/não permite a leitura automática/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Preencher manualmente" })).toBeVisible();
});
