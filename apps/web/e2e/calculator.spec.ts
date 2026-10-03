import { expect, test } from "@playwright/test";
import { field, fillCalculatorExample, watchProblems } from "./helpers";

test("the calculator runs all four scenarios with real inputs", async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto("/avaliar");
  await fillCalculatorExample(page);

  // INE reference for the chosen parish.
  await expect(page.getByText("Referência de mercado (INE)")).toBeVisible();
  await expect(page.getByText(/Preço pedido: .*face à mediana/)).toBeVisible();

  // 400 000 asked vs 440 000 market value: 9 % below → opportunity.
  await expect(page.getByText("Oportunidade", { exact: true })).toBeVisible();

  const results = page.getByRole("table", { name: "Comparação de cenários" });
  for (const name of ["Revenda", "Arrendamento", "AL", "Cessão"]) {
    await expect(results.getByRole("columnheader", { name: new RegExp(name) })).toBeVisible();
  }
  const profitRow = results.getByRole("row", { name: /Lucro líquido/ });
  await expect(profitRow.getByRole("cell")).toHaveCount(4);
  for (const cell of await profitRow.getByRole("cell").all()) {
    await expect(cell).toHaveText(/\d.*€/);
  }
  await expect(results.getByText("Melhor opção")).toBeVisible();

  // Changing the goal can change the best option; the radio reflects the choice.
  const goal = page.getByRole("radio", { name: "Menos capital necessário" });
  await goal.click();
  await expect(goal).toHaveAttribute("aria-checked", "true");

  // A warning appears with a large loan.
  await field(page, "Montante do empréstimo").fill("390000");
  // Each scenario lists its warnings inside its own collapsible panel.
  const rentalDetails = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Arrendamento" }) });
  await rentalDetails.locator("summary").click();
  await expect(
    rentalDetails.getByText(/excede o limite recomendado pelo Banco de Portugal/),
  ).toBeVisible();

  expect(problems).toEqual([]);
});

test("sensitivity analysis responds to the slider", async ({ page }) => {
  await page.goto("/avaliar");
  await fillCalculatorExample(page);
  const panel = page.getByRole("region", { name: "Análise de sensibilidade" });
  await panel.getByRole("radio", { name: "Juro" }).click();
  await panel
    .getByRole("combobox", { name: "Indicador", exact: true })
    .selectOption({ label: "Cash flow mensal" });
  const slider = panel.getByRole("slider");
  await slider.fill("0.02");
  await expect(panel.getByRole("status").or(panel.locator("output"))).toContainText("+2");
  const rental = panel.getByRole("row", { name: /Arrendamento/ });
  // Higher interest → lower cash flow: the difference is negative.
  await expect(rental.getByRole("cell").last()).toHaveText(/^−/);
});

test("address lookup selects the parish (lookup service mocked)", async ({ page }) => {
  await page.goto("/avaliar");
  // Use a real area id from the reference API, so the selects can show it.
  const areas = await (await page.request.get("/api/areas")).json();
  const lisboa = areas.find((a: { path: string }) => a.path === "lisboa");
  const city = lisboa.children.find((a: { path: string }) => a.path === "lisboa/lisboa");
  const parish = city.children[0];
  await page.route("**/api/geocode?**", (route) =>
    route.fulfill({
      json: { status: "ok", lat: 38.73, lng: -9.13, areaId: parish.id, areaName: parish.name },
    }),
  );
  await page.getByRole("textbox", { name: "Morada" }).fill("Rua Exemplo 1, Lisboa");
  await page.getByRole("button", { name: "Localizar" }).click();
  await expect(page.getByText(`Localizado em ${parish.name}.`)).toBeVisible();
  await expect(page.getByLabel("Freguesia")).toHaveValue(String(parish.id));
});

test("the link reader refuses sites that are not allowed", async ({ page }) => {
  await page.goto("/avaliar");
  await page
    .getByRole("textbox", { name: "Link do anúncio" })
    .fill("https://www.idealista.pt/imovel/1/");
  await page.getByRole("button", { name: "Ler anúncio" }).click();
  await expect(page.getByText(/não permite a leitura automática/)).toBeVisible();
});
