import { expect, test } from "@playwright/test";
import { FEATURES } from "../src/lib/features";
import { expectNoHorizontalScroll, field, watchProblems } from "./helpers";

test("home page in Portuguese and English, with the language switch", async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Saiba se um imóvel vale a pena antes de avançar",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Know whether a property is worth it before you commit",
  );
  expect(problems).toEqual([]);
});

test("the home page link box opens Avaliar anúncio and reads the link", async ({ page }) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        analysisId: "test",
        areaId: null,
        property: { askingPrice: 480000, propertyType: "apartamento", bedrooms: 2 },
      },
    }),
  );
  await page.goto("/");
  // The box is in the first screen, with the supported sites underneath.
  const box = page.getByRole("textbox", { name: "Link do anúncio" });
  await expect(box).toBeInViewport();
  await expect(page.getByText("Idealista.pt e Imovirtual.com suportados")).toBeVisible();

  const listing = "https://www.imovirtual.com/pt/anuncio/t2-matosinhos-ID1";
  await box.fill(listing);
  await page.getByRole("button", { name: "Avaliar" }).click();
  await expect(page).toHaveURL(/\/avaliar\?link=/);
  await expect(page.getByRole("textbox", { name: "Link do anúncio" })).toHaveValue(listing);
  await expect(page.getByText(/Dados lidos do anúncio/)).toBeVisible();
  await expect(field(page, "Preço pedido")).toHaveValue("480000");
});

test("the home page offers manual entry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Não tem link? Preencha os dados à mão" }).click();
  await expect(field(page, "Preço pedido")).toBeVisible();
});

test("unknown pages show the localised 404", async ({ page }) => {
  const response = await page.goto("/esta-pagina-nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("dormant sections: no Vender or Preços in the menu or on the home page; pages are 404", async ({
  page,
  request,
}) => {
  test.skip(FEATURES.sell && FEATURES.prices, "both sections are on");
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Menu" });
  await expect(menu.getByRole("link", { name: "Avaliar anúncio" })).toBeVisible();
  if (!FEATURES.sell) {
    await expect(menu.getByRole("link", { name: "Vender" })).toHaveCount(0);
    expect((await request.get("/vender")).status()).toBe(404);
  }
  if (!FEATURES.prices) {
    await expect(menu.getByRole("link", { name: "Preços" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Explorar preços" })).toHaveCount(0);
    for (const path of ["/precos", "/precos/lisboa", "/api/prices/lisboa"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  }
});

test("prices: overview → district → municipality", async ({ page }) => {
  test.skip(!FEATURES.prices, "Preços is dormant");
  const problems = watchProblems(page);
  await page.goto("/precos");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Preços");
  await page.getByRole("link", { name: "Lisboa", exact: true }).first().click();
  await expect(page).toHaveURL(/\/precos\/lisboa$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lisboa");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Cascais", exact: true }).first().click();
  await expect(page).toHaveURL(/\/precos\/lisboa\/cascais$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cascais");
  await expect(page.getByText("€/m²").first()).toBeVisible();
  expect(problems).toEqual([]);
});

test("methodology page explains the metrics and has a FAQ", async ({ page }) => {
  await page.goto("/metodologia");
  await expect(page.getByRole("heading", { level: 1, name: "Como calculamos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Os indicadores" })).toBeVisible();
  await expect(page.getByText("TIR anual")).toBeVisible();
  await page.getByText("Os resultados substituem um contabilista?").click();
  await expect(page.getByText(/confirme os impostos e os custos/)).toBeVisible();
  await page.goto("/en/metodologia");
  await expect(page.getByRole("heading", { level: 1, name: "How we calculate" })).toBeVisible();
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const path of [
    "/",
    "/avaliar",
    ...(FEATURES.prices ? ["/precos", "/precos/lisboa/cascais"] : []),
    "/metodologia",
    "/entrar",
  ]) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }
});

test("security headers are sent", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test.describe("with an English browser", () => {
  test.use({ locale: "en-US" });

  test("the site still opens in Portuguese", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
    // Browsers must not machine-translate it into English.
    await expect(page.locator("html")).toHaveAttribute("translate", "no");
    await expect(page.locator('meta[name="google"]')).toHaveAttribute("content", "notranslate");
  });
});
