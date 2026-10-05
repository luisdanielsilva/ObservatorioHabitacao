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
  // Monthly, yearly and lifetime figures; no sale profit for a rental kept for good.
  for (const name of ["Cash flow mensal", "Cash flow anual", "Cash flow acumulado"]) {
    await expect(results.getByRole("term").filter({ hasText: name })).toBeVisible();
  }
  await expect(results.getByRole("term").filter({ hasText: "Lucro líquido" })).toHaveCount(0);
  // 400 000 asked vs 440 000 market value: 9 % below → opportunity.
  await expect(results.getByText("Oportunidade", { exact: true })).toBeVisible();

  // A loan above the limit triggers a warning in the deal's details.
  await step(page, "Detalhes do negócio").getByRole("button", { name: "Alterar" }).click();
  await page.getByRole("switch", { name: "Com crédito habitação" }).click();
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
  // The resale has no assumptions of its own (no utilities while holding).
  await expect(page.getByText("Água, luz e gás (mensal)")).toHaveCount(0);
  // A deal's required inputs are checked before moving on.
  await nextPanel(page);
  await expect(step(page, "Detalhes do negócio").getByRole("alert")).toHaveText(
    "Indique: preço de venda após obras",
  );
  await expect(field(page, "Preço de venda após obras")).toBeFocused();
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
  // Side by side, without ranking: no "best option" and no goal to choose.
  await expect(results.getByText("Melhor opção")).toHaveCount(0);
  await expect(results.getByRole("radiogroup", { name: "Objetivo" })).toHaveCount(0);
  // The long-term rental's monthly cash flow is in the comparison.
  const cashFlow = table.getByRole("row", { name: /^Cash flow mensal/ });
  await expect(cashFlow.getByRole("cell").nth(1)).toHaveText(/\d.*€/);

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
  // No financing by default: the buyer pays with their own money.
  await expect(loan).toHaveCount(0);
  await expect(
    page.getByText(/financiam até 80% do valor \(entrada mínima de 20%\)/),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Com crédito habitação" }).click();
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
  await page.getByLabel("Distrito").selectOption({ label: "Braga" });
  await page.getByRole("button", { name: "Continuar" }).click();
  // A clear message, the missing fields marked, and the focus on the first one.
  await expect(step(page, "Imóvel").getByRole("alert")).toHaveText(
    "Indique: tipologia, área útil, localização (pelo menos o concelho)",
  );
  await expect(page.getByLabel("Concelho")).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, "Área útil")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Tipologia")).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, "Preço pedido")).not.toHaveAttribute("aria-invalid");
  await expect(page.getByLabel("Concelho")).toBeFocused();
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

test("sale chart: lowest price without a loss, and profit above it", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Compra e revenda");
  await nextPanel(page);
  await field(page, "Preço de venda após obras").fill("480000");
  await showResults(page);

  const results = step(page, "Resultados");
  await expect(results.getByText("Saldo acumulado ao longo do tempo")).toHaveCount(0);
  const sale = results.getByRole("region", { name: "Preço de venda e lucro" });
  await expect(sale.getByText("Preço mínimo de venda sem prejuízo")).toBeVisible();
  // 400 000 bought: with costs and taxes, breaking even needs a higher sale price.
  const breakEven = sale.getByText("Preço mínimo de venda sem prejuízo").locator("+ dd");
  await expect(breakEven).toHaveText(/^4\d\d\s\d{3}\s€$/);

  // Moving the slider up raises the profit read out next to it.
  const slider = sale.getByRole("slider", { name: "Preço de venda" });
  const output = sale.locator("output");
  await slider.press("Home");
  const atMin = await output.textContent();
  await slider.press("End");
  await expect(output).not.toHaveText(atMin!);

  // Sharing comes after the scenario's name and save, as mock-ups that do nothing yet.
  const share = results.getByRole("region", { name: "Partilhar resultados" });
  for (const name of ["Email", "WhatsApp", "Facebook Messenger", "Ver PDF"]) {
    await expect(share.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  const saveBox = await results.getByRole("button", { name: "Guardar", exact: true }).boundingBox();
  const shareBox = await share.boundingBox();
  expect(shareBox!.y).toBeGreaterThan(saveBox!.y);
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

test("long-term rental: kept for good, consecutive leases, legal rent update", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Arrendamento de longa duração");
  await nextPanel(page);
  // No holding period: the property is let for good.
  await expect(field(page, "Anos de detenção")).toHaveCount(0);
  await expect(page.getByText(/arrendado de forma permanente, sem venda/)).toBeVisible();
  await expect(field(page, "Duração de cada contrato")).toHaveValue("3");

  await page.getByRole("button", { name: "Mostrar pressupostos" }).last().click();
  await expect(field(page, "Aumento anual da renda")).toHaveValue("2,24");
  await expect(field(page, "Vazio entre contratos")).toHaveValue("1");
  await expect(field(page, "Condomínio (mensal)")).toHaveValue("25");
  await expect(field(page, "Seguro multirriscos (mensal)")).toHaveValue("20");
  // The help next to the rent increase names the legal source.
  await page.getByRole("button", { name: /Aumento anual da renda/ }).click();
  await expect(page.getByText(/Aviso n\.º 23174\/2025\/2/)).toBeVisible();

  await field(page, "Renda mensal esperada").fill("1600");
  await showResults(page);
  await expect(
    step(page, "Resultados").getByText(/sem venda: cash flow acumulado em 30 anos/),
  ).toBeVisible();
});

test("financing: off by default, TAEG rate, term up to 50 years, fields aligned", async ({
  page,
}) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Arrendamento de longa duração");
  const loanSwitch = page.getByRole("switch", { name: "Com crédito habitação" });
  await expect(loanSwitch).toHaveAttribute("aria-checked", "false");
  await loanSwitch.click();

  const rate = field(page, "Taxa de juro (TAEG)");
  const term = field(page, "Prazo");
  await expect(rate).toBeVisible();
  await expect(term).toHaveValue("30");
  await term.fill("60");
  await term.blur();
  await expect(term).toHaveValue("50");

  // The three loan inputs start at the same height.
  const tops = await Promise.all(
    [field(page, "Montante do empréstimo"), rate, term].map(
      async (f) => (await f.boundingBox())!.y,
    ),
  );
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
});

test("purchase costs, loan charges and yearly IMI are shown", async ({ page }) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Arrendamento de longa duração");
  await page.getByRole("switch", { name: "Com crédito habitação" }).click();
  // The note on the TAEG: loan charges are added separately at purchase.
  await page.getByRole("button", { name: /Taxa de juro \(TAEG\)/ }).click();
  await expect(page.getByText(/são somados à parte, na compra/)).toBeVisible();
  await page.keyboard.press("Escape");
  await nextPanel(page);
  await fillRental(page);
  await showResults(page);

  const details = step(page, "Resultados").locator("details").first();
  for (const item of [
    "IMT",
    "Imposto do Selo (compra)",
    "Imposto do Selo (crédito)",
    "Casa Pronta (escritura e registo)",
    "Avaliação do imóvel (banco)",
    "Abertura de processo (banco)",
  ]) {
    await expect(details.getByText(item, { exact: true })).toBeVisible();
  }
  // Recurring yearly costs, IMI first.
  await expect(details.getByText("Custos anuais")).toBeVisible();
  await expect(details.getByText("IMI", { exact: true })).toBeVisible();
  await expect(details.getByText("Seguro multirriscos", { exact: true })).toBeVisible();
});
