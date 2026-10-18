import { expect, test } from "@playwright/test";
import { FEATURES } from "../src/lib/features";
import { clearRateLimits, expectNoHorizontalScroll, field, watchProblems } from "./helpers";

test("home page in Portuguese and English, with the language switch", async ({ page }) => {
  const problems = watchProblems(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Queres comprar um imóvel e não sabes se é um bom investimento?",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Buying a property and not sure it's a good investment?",
  );
  expect(problems).toEqual([]);
});

test("home page: the situation picked sets the question and the way in", async ({ page }) => {
  await page.goto("/");
  const situations = page.getByRole("tablist", { name: "A tua situação" });
  const panel = page.getByRole("tabpanel");
  await expect(situations.getByRole("tab", { name: /Vou comprar/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByRole("textbox", { name: "Link do anúncio" })).toBeVisible();

  // The arrow keys move between situations, as in any tab list.
  await situations.getByRole("tab", { name: /Vou comprar/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    situations.getByRole("tab", { name: /Quero arrendar|Quero vender/ }).first(),
  ).toBeFocused();

  await situations.getByRole("tab", { name: /Vi um anúncio/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Viste um anúncio e não sabes se o preço é justo?",
  );
  test.skip(!FEATURES.sell, "Vender is dormant");
  await situations.getByRole("tab", { name: /Quero vender/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Queres vender a tua casa e não sabes quanto vale?",
  );
  await panel.getByRole("link", { name: "Avaliar a minha casa" }).click();
  await expect(page).toHaveURL(/\/vender$/);
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
  await expect(page.getByText("Idealista.pt", { exact: true })).toBeVisible();
  await expect(page.getByText("Imovirtual.com", { exact: true })).toBeVisible();

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
  await page.getByRole("link", { name: "Não tens link? Preenche os dados à mão" }).click();
  await expect(field(page, "Preço pedido")).toBeVisible();
});

test("unknown pages show the localised 404", async ({ page }) => {
  const response = await page.goto("/esta-pagina-nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("home page: the owners' banner opens Vender, and its link Avaliar anúncio", async ({
  page,
}) => {
  test.skip(!FEATURES.sell, "Vender is dormant");
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Quanto vale a minha casa?" });
  await expect(banner.getByRole("listitem")).toHaveText([
    "Gratuito",
    "1 minuto",
    "Sem compromisso",
  ]);
  await banner.getByRole("link", { name: "Viste um anúncio? Vê se o preço é justo" }).click();
  await expect(page).toHaveURL(/\/avaliar$/);
  await page.goBack();
  await banner.getByRole("link", { name: "Avaliar a minha casa" }).click();
  await expect(page).toHaveURL(/\/vender$/);
  await expect(page.getByRole("heading", { name: "Quanto vale a tua casa?" })).toBeVisible();
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
    await expect(page.getByRole("link", { name: "Avaliar a minha casa" })).toHaveCount(0);
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
  await expect(page.getByText(/confirma os impostos e os custos/)).toBeVisible();
  await page.goto("/en/metodologia");
  await expect(page.getByRole("heading", { level: 1, name: "How we calculate" })).toBeVisible();
});

test("privacy policy: the data, purposes, legal bases and rights", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de privacidade" }),
  ).toBeVisible();
  for (const name of ["Que dados recolhemos", "Os teus direitos", "Idade mínima"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("cell", { name: "Telefone, data de nascimento" })).toBeVisible();
  await expect(page.getByText(/CNPD, www\.cnpd\.pt/)).toBeVisible();
});

test("home page: other questions, each with an illustrative answer", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Outras perguntas a que respondemos" });
  await expect(section.getByText("Valores ilustrativos.", { exact: false })).toBeVisible();
  await expect(section.getByRole("heading", { level: 3 })).toHaveCount(6);
  await expect(section.getByRole("link", { name: "Avaliar anúncio" })).toHaveAttribute(
    "href",
    /\/avaliar$/,
  );
  await expect(section.getByRole("link", { name: "Vender" })).toHaveAttribute("href", /\/vender$/);
  // The cards are information only; the example amounts are text.
  await expect(section.getByRole("link")).toHaveCount(2);
  for (const text of ["€ 3 420/m²", "€ 9 800", "€ 224 700", "€ 42 600", "€ 187 000"]) {
    await expect(section.getByText(text, { exact: true }).first()).toBeVisible();
  }
});

test("contact: a suggestion opened in place on the home page, checked, then sent", async ({
  page,
}) => {
  clearRateLimits("contact:");
  await page.goto("/");
  const box = page.getByRole("region", { name: "Precisas de ajuda ou tens uma ideia?" });
  const suggest = box.getByRole("button", { name: "Sugerir uma funcionalidade" });
  const help = box.getByRole("button", { name: "Pedir ajuda" });
  await expect(box.getByLabel("Assunto")).toBeHidden();

  await suggest.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(suggest).toHaveAttribute("aria-expanded", "true");
  await expect(
    box.getByRole("heading", { level: 3, name: "Sugerir uma funcionalidade" }),
  ).toBeVisible();
  // The buttons above chose the type: the form has no picker of its own.
  await expect(box.getByRole("radio")).toHaveCount(0);

  await box.getByRole("button", { name: "Enviar" }).click();
  await expect(box.getByText("Escreve o teu nome.")).toBeVisible();
  await expect(box.getByText(/Escreve um email válido/)).toBeVisible();

  await box.getByLabel("Nome").fill("Rui Teste");
  await box.getByLabel("Email").fill("rui@example.pt");
  await box.getByLabel("Assunto").fill("Comparar dois imóveis");
  await box.getByLabel("Descrição").fill("curta");
  await box.getByRole("button", { name: "Enviar" }).click();
  await expect(box.getByText(/Descreve o pedido/)).toBeVisible();
  await expect(box.getByLabel("Assunto")).toHaveValue("Comparar dois imóveis");

  // Folded away and opened again: what was typed is still there.
  await suggest.click();
  await expect(suggest).toHaveAttribute("aria-expanded", "false");
  await expect(box.getByLabel("Assunto")).toBeHidden();
  await help.click();
  await expect(box.getByRole("heading", { level: 3, name: "Pedir ajuda" })).toBeVisible();
  await expect(box.getByLabel("Assunto")).toHaveValue("Comparar dois imóveis");
  await suggest.click();
  await expect(help).toHaveAttribute("aria-expanded", "false");

  await box
    .getByLabel("Descrição")
    .fill("Gostava de ver dois anúncios lado a lado, com as contas.");
  await box.getByRole("button", { name: "Enviar" }).click();
  await expect(box.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  await box.getByRole("button", { name: "Fechar" }).last().click();
  await expect(suggest).toHaveAttribute("aria-expanded", "false");
});

test("contact: the Contactos page keeps its own type picker", async ({ page }) => {
  await page.goto("/contactos?tipo=sugestao");
  await expect(page.getByRole("heading", { level: 1, name: "Contacto e sugestões" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Sugerir uma funcionalidade/ })).toBeChecked();
});

test("donations: the Portuguese widget on the home page, reached from the footer", async ({
  page,
}) => {
  await page.goto("/contactos");
  await page.getByRole("contentinfo").getByRole("link", { name: "Apoiar" }).click();
  await expect(page).toHaveURL(/\/#apoiar$/);
  const section = page.locator("#apoiar");
  await expect(section.getByRole("heading", { name: /Apoiar o Observatório/ })).toBeVisible();
  await expect(section.getByRole("button", { name: "5 €", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await section.getByRole("button", { name: "10 €", exact: true }).click();
  await expect(section.getByRole("button", { name: "Doar 10 €" })).toBeVisible();
});

test("home page: the example report, page by page, and its PDF", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby=report]");
  await expect(section.getByRole("heading", { name: /relatório PDF/ })).toBeVisible();

  // An entry of the contents opens the viewer at its page; Esc closes it.
  await section.getByRole("button", { name: /Resumo do dinheiro/ }).click();
  const viewer = page.getByRole("dialog", { name: /Relatório de exemplo/ });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("Página 3 de 7")).toBeVisible();
  await expect(viewer.getByRole("img", { name: /^Página 3:/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(section.getByRole("button", { name: /Resumo do dinheiro/ })).toBeFocused();

  const pdf = section.getByRole("link", { name: /Descarregar o PDF \(7 páginas/ });
  const response = await page.request.get((await pdf.getAttribute("href"))!);
  expect(response.headers()["content-type"]).toBe("application/pdf");
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 375, height: 800 } });
  for (const path of [
    "/",
    "/avaliar",
    ...(FEATURES.prices ? ["/precos", "/precos/lisboa/cascais"] : []),
    "/metodologia",
    "/entrar",
    "/privacidade",
    "/contactos",
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
