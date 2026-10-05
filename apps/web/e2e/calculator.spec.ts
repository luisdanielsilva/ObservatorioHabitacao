import { expect, test } from "@playwright/test";
import {
  chooseDeals,
  field,
  fillPropertyByHand,
  fillRental,
  nextPanel,
  showResults,
  step,
  watchProblems,
} from "./helpers";

test("one deal: long-term rental, results and adding a strategy", async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto("/avaliar");
  await fillPropertyByHand(page);

  // The property step collapses into a summary; the deal step opens.
  await expect(step(page, "Imóvel")).toContainText("Apartamento T2 · 80 m² · 400 000 €");
  await chooseDeals(page, "Arrendamento de longa duração");
  await nextPanel(page);
  await fillRental(page);
  await showResults(page);

  const results = step(page, "Resultados");
  await expect(results.getByRole("term").filter({ hasText: "Cash flow mensal" })).toBeVisible();
  // 400 000 asked vs 440 000 market value: 9 % below → opportunity.
  await expect(results.getByText("Oportunidade", { exact: true })).toBeVisible();

  // A loan above the limit triggers a warning in the deal's details.
  await step(page, "Detalhes do negócio").getByRole("button", { name: "Alterar" }).click();
  await field(page, "Montante do empréstimo").fill("390000");
  await nextPanel(page);
  await showResults(page);
  await expect(
    results.getByText(/excede o limite recomendado pelo Banco de Portugal/),
  ).toBeVisible();

  // The comparison offers the other strategies; adding one opens its details.
  await results.getByRole("button", { name: "Comparar" }).click();
  const table = results.getByRole("table", { name: "Comparação de cenários" });
  for (const name of ["Revenda", "Arrendamento", "AL", "Cessão"]) {
    await expect(table.getByRole("columnheader", { name: new RegExp(name) })).toBeVisible();
  }
  await table.getByRole("button", { name: "Preencher dados" }).first().click();
  await expect(page.getByRole("heading", { name: "2 de 3: Compra e revenda" })).toBeVisible();
  await field(page, "Preço de venda após obras").fill("480000");
  await nextPanel(page);
  await showResults(page);
  await expect(step(page, "Tipo de negócio")).toContainText(
    "Compra e revenda, Arrendamento de longa duração",
  );

  expect(problems).toEqual([]);
});

test("several deals: details in turn, then compared side by side", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Compra e revenda", "Arrendamento de longa duração", "Alojamento local");

  await expect(page.getByRole("heading", { name: "1 de 4: Compra e financiamento" })).toBeVisible();
  await nextPanel(page);

  await expect(page.getByRole("heading", { name: "2 de 4: Compra e revenda" })).toBeVisible();
  // A deal's required inputs are checked before moving on.
  await nextPanel(page);
  await expect(page.getByText("Indique: preço de venda após obras")).toBeVisible();
  await field(page, "Preço de venda após obras").fill("480000");
  await nextPanel(page);

  await expect(
    page.getByRole("heading", { name: "3 de 4: Arrendamento de longa duração" }),
  ).toBeVisible();
  await fillRental(page);
  await nextPanel(page);

  await expect(page.getByRole("heading", { name: "4 de 4: Alojamento local" })).toBeVisible();
  const seasons = [
    ["Época alta (jun–set)", "150", "85"],
    ["Época média (abr, mai, out)", "110", "70"],
    ["Época baixa (nov–mar)", "80", "50"],
  ];
  for (const [season, rate, occupancy] of seasons) {
    await page.getByRole("textbox", { name: `Preço médio por noite — ${season}` }).fill(rate!);
    await page.getByRole("textbox", { name: `Ocupação — ${season}` }).fill(occupancy!);
  }
  await showResults(page);

  const results = step(page, "Resultados");
  const table = results.getByRole("table", { name: "Comparação de cenários" });
  for (const name of ["Revenda", "Arrendamento", "AL"]) {
    await expect(table.getByRole("columnheader", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(table.getByRole("columnheader", { name: /Cessão/ })).toHaveCount(0);
  await expect(table.getByText("Melhor opção")).toBeVisible();

  // One tab per deal.
  await results.getByRole("tab", { name: "Alojamento local" }).click();
  await expect(results.getByRole("tabpanel")).toContainText("Rentabilidade líquida");
  await results.getByRole("tab", { name: "Compra e revenda" }).click();
  await expect(results.getByRole("tabpanel")).toContainText("ROI");
});

test("the property use sets the default loan (90 % own home, 80 % otherwise)", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Compra e revenda");
  const loan = field(page, "Montante do empréstimo");
  await expect(loan).toHaveAttribute("placeholder", "320000");
  await expect(
    page.getByText(/financiam até 80% do valor \(entrada mínima de 20%\)/),
  ).toBeVisible();

  await page.getByLabel("Finalidade").selectOption({ label: "Habitação própria e permanente" });
  await expect(loan).toHaveAttribute("placeholder", "360000");
  await expect(
    page.getByText(/financiam até 90% do valor \(entrada mínima de 10%\)/),
  ).toBeVisible();

  // Without a loan, the limit stays as information.
  await page.getByRole("switch", { name: "Com crédito habitação" }).click();
  await expect(loan).toHaveCount(0);
  await expect(page.getByText(/financiam até 90% do valor/)).toBeVisible();
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
  await expect(page.getByRole("checkbox", { name: /^Compra e revenda/ })).toHaveCount(0);
});

test("contract position sale on its own", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Cessão de posição contratual");
  await expect(page.getByRole("heading", { name: "1 de 2: Finalidade e impostos" })).toBeVisible();
  await expect(field(page, "Montante do empréstimo")).toHaveCount(0);
  await nextPanel(page);
  await field(page, "Sinal pago").fill("40000");
  await field(page, "Preço da cessão").fill("60000");
  await field(page, "Valor de mercado atual").fill("440000");
  await showResults(page);
  await expect(
    step(page, "Resultados").getByRole("term").filter({ hasText: "Retorno sobre o sinal" }),
  ).toBeVisible();
});

test("sensitivity analysis responds to the slider", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Arrendamento de longa duração");
  await nextPanel(page);
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

test("tax inputs: optional other income and the englobamento note", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Arrendamento de longa duração");
  await expect(field(page, "Outros rendimentos coletáveis por ano (opcional)")).toBeVisible();
  await expect(page.getByText(/IRS calculado pelos escalões de 20\d\d/)).toBeVisible();
  await expect(page.getByText("Valorização anual")).toHaveCount(0);
  await nextPanel(page);
  await expect(page.getByText(/englobar as rendas pode pagar menos IRS/)).toBeVisible();
  await fillRental(page);
  await showResults(page);
  await expect(
    step(page, "Resultados").getByRole("term").filter({ hasText: "Cash flow mensal" }),
  ).toBeVisible();
});
