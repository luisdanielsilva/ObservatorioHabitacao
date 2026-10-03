import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { field } from "./helpers";

/**
 * Sign-in with a magic link read from the dev server's log (emails are logged when no email
 * provider is configured). Runs only when E2E_SERVER_LOG points to that log.
 */
const LOG = process.env.E2E_SERVER_LOG;

test.skip(!LOG, "set E2E_SERVER_LOG to the dev server log to run the sign-in flow");

test("sign in, save a scenario, export and delete the account", async ({ page }) => {
  const email = `e2e+${Date.now()}@example.pt`;

  await page.goto("/avaliar");
  await field(page, "Preço pedido").fill("250000");
  await field(page, "Preço de venda após obras").fill("300000");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(/Entre na sua conta para guardar/)).toBeVisible();
  await page.getByRole("link", { name: "Guardar →" }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page).toHaveURL(/\/entrar\/verificar/);

  let link: string | undefined;
  await expect
    .poll(() => {
      const log = readFileSync(LOG!, "utf8");
      link = [...log.matchAll(/https?:\/\/\S+\/api\/auth\/callback\/resend\?\S+/g)]
        .map((m) => m[0])
        .filter((l) => l.includes(encodeURIComponent(email)))
        .at(-1);
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link!);

  // The inputs typed before signing in are restored.
  await expect(field(page, "Preço pedido")).toHaveValue("250000");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(/cenario=\d+/);

  await page.goto("/conta");
  await expect(page.getByRole("heading", { name: "Cenários guardados" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir" })).toHaveCount(1);

  const exported = await page.request.get("/api/account/export");
  expect(exported.status()).toBe(200);
  expect((await exported.json()).user.email).toBe(email);

  await page.getByLabel("Escreva APAGAR para confirmar").fill("APAGAR");
  await page.getByRole("button", { name: "Apagar a minha conta" }).click();
  await expect(page).not.toHaveURL(/conta/);
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
});
