import { expect, test } from "@playwright/test";
import {
  chooseDeals,
  field,
  fillPropertyByHand,
  nextPanel,
  setPlan,
  showResults,
  signInWithLink,
  step,
} from "./helpers";

/**
 * Sign-in with a magic link read from the dev server's log (emails are logged when no email
 * provider is configured). Runs only when E2E_SERVER_LOG points to that log.
 */
const LOG = process.env.E2E_SERVER_LOG;

test.skip(!LOG, "set E2E_SERVER_LOG to the dev server log to run the sign-in flow");

test("sign in, save a scenario, export and delete the account", async ({ page }) => {
  const email = `e2e+${Date.now()}@example.pt`;

  await page.goto("/avaliar");
  await fillPropertyByHand(page, "250000");
  await chooseDeals(page, "Compra e revenda");
  await nextPanel(page);
  await field(page, "Preço de venda após obras").fill("300000");
  await showResults(page);
  const bar = page.getByRole("region", { name: "Guardar cenário" });
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    bar.getByText(/Guardar cenários faz parte do plano pago\. Se já o tens/),
  ).toBeVisible();
  await bar.getByRole("link", { name: "Entrar →" }).click();

  await signInWithLink(page, email, LOG!);

  // The inputs typed before signing in are restored, and the page opens at the results. The
  // save asked for is tried straight away: refused on the free plan.
  await expect(step(page, "Imóvel")).toContainText("250 000 €");
  await expect(step(page, "Tipo de negócio")).toContainText("Compra e revenda");
  await expect(bar.getByText("Guardar cenários faz parte do plano pago.")).toBeVisible();

  // On the paid plan (set by an admin until payments exist) it goes through.
  setPlan(email, "premium");
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(/cenario=\d+/);

  await page.goto("/conta");
  await expect(page.getByRole("heading", { name: "Cenários guardados" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir" })).toHaveCount(1);

  const exported = await page.request.get("/api/account/export");
  expect(exported.status()).toBe(200);
  expect((await exported.json()).user.email).toBe(email);

  await page.getByLabel("Escreve APAGAR para confirmar").fill("APAGAR");
  await page.getByRole("button", { name: "Apagar a minha conta" }).click();
  await expect(page).not.toHaveURL(/conta/);
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
});

test("development: the sign-in link is shown on screen when no email is sent", async ({ page }) => {
  // An address with "+", which must survive the round trip through the page.
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(`e2e+devlink${Date.now()}@example.pt`);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page).toHaveURL(/\/entrar\/verificar/);
  await page.getByRole("link", { name: "Entrar com o link (dev)" }).click();

  // First sign-in: the profile is asked for before going on (issue #7).
  await expect(page).toHaveURL(/\/conta\/perfil/);
  await expect(page.getByRole("heading", { name: "Completa o teu perfil" })).toBeVisible();
  // Nothing else is available until it's filled in.
  expect((await page.request.get("/api/scenarios/1/pdf")).status()).toBe(401);
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/conta\/perfil/);

  const save = page.getByRole("button", { name: "Guardar e continuar" });
  await save.click();
  await expect(page.getByText("Escreve o teu nome.")).toBeVisible();
  await page.getByLabel("Nome").fill("Ana Teste");
  await page.getByLabel(/Telefone/).fill("123");
  await page.getByLabel(/Data de nascimento/).fill("2015-01-01");
  await save.click();
  await expect(page.getByText(/Este número não parece válido/)).toBeVisible();
  await expect(page.getByText("As contas são só para maiores de 16 anos.")).toBeVisible();
  // What was typed is kept.
  await expect(page.getByLabel("Nome")).toHaveValue("Ana Teste");
  await page.getByLabel(/Telefone/).fill("+351 912 345 678");
  await page.getByLabel(/Data de nascimento/).fill("1990-05-01");
  await save.click();

  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { name: "Cenários guardados" })).toBeVisible();
  await expect(page.getByLabel(/Telefone/)).toHaveValue("+351 912 345 678");
  await expect(page.getByLabel(/Data de nascimento/)).toHaveValue("1990-05-01");
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.user).toMatchObject({ name: "Ana Teste", birthDate: "1990-05-01" });

  // The phone can be deleted later in the settings.
  await page.getByLabel(/Telefone/).fill("");
  await page.getByRole("button", { name: "Guardar definições" }).click();
  await expect(page.getByText("Definições guardadas.")).toBeVisible();
  expect((await (await page.request.get("/api/account/export")).json()).user.phone).toBeNull();
});
