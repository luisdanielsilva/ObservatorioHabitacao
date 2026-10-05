import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  chooseDeals,
  field,
  fillPropertyByHand,
  nextPanel,
  saveSignedIn,
  showResults,
  step,
} from "./helpers";

/** Sharing needs a saved scenario, so a signed-in user (magic link from the server log). */
const LOG = process.env.E2E_SERVER_LOG;

test.skip(!LOG, "set E2E_SERVER_LOG to the dev server log to sign in");

test("sharing: read-only link by WhatsApp, email and the account email; PDF; link off", async ({
  page,
  browser,
}) => {
  const email = `e2e+share${Date.now()}@example.pt`;
  await page.context().route("https://wa.me/**", (r) => r.fulfill({ body: "WhatsApp" }));

  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Compra e revenda");
  await nextPanel(page);
  await field(page, "Preço de venda após obras").fill("480000");
  await showResults(page);
  await saveSignedIn(page, email, LOG!);

  const results = step(page, "Resultados");
  const share = results.getByRole("region", { name: "Partilhar resultados" });
  await expect(share.getByLabel("Link só de leitura")).toHaveCount(0);

  // WhatsApp: the link is created and sent in a new tab, with a short text.
  const popup = page.waitForEvent("popup");
  await share.getByRole("button", { name: "WhatsApp" }).click();
  const whatsapp = await popup;
  await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
  const text = new URL(whatsapp.url()).searchParams.get("text")!;
  await whatsapp.close();
  const link = await share.getByLabel("Link só de leitura").inputValue();
  expect(link).toMatch(/\/partilha\/[\w-]{16}$/);
  expect(text).toMatch(/^Simulação de investimento imobiliário no OlhoVivo: Apartamento T2 em .+ /);
  expect(text.endsWith(` ${link}`)).toBe(true);

  // Now saved as shown: the channels are plain links with the same read-only link.
  const mailto = await share.getByRole("link", { name: "Email" }).getAttribute("href");
  expect(mailto).toMatch(/^mailto:\?subject=/);
  expect(decodeURIComponent(mailto!)).toContain(link);
  await expect(share.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    new RegExp(`^https://wa\\.me/\\?text=.*${encodeURIComponent(link)}$`),
  );

  // The account email gets the link.
  await share.getByRole("button", { name: "Enviar para o email da conta" }).click();
  await expect(share.getByText(`Link enviado para ${email}.`)).toBeVisible();
  await expect
    .poll(() => readFileSync(LOG!, "utf8").includes(`to=${email} subject="Simulação OlhoVivo:`))
    .toBe(true);
  expect(readFileSync(LOG!, "utf8")).toContain(`/partilha/${link.split("/partilha/")[1]}`);

  // Ver PDF downloads the full report.
  const download = page.waitForEvent("download");
  await share.getByRole("link", { name: "Ver PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^olhovivo-.*\.pdf$/);
  expect(
    readFileSync((await file.path())!)
      .subarray(0, 4)
      .toString(),
  ).toBe("%PDF");

  // Anyone with the link sees the results, read-only, with the sale chart.
  const visitor = await browser.newPage();
  await visitor.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(visitor.getByRole("heading", { name: /^Cenário partilhado: / })).toBeVisible();
  await expect(visitor.getByRole("region", { name: "Preço de venda e lucro" })).toBeVisible();
  await expect(visitor.getByRole("textbox")).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);

  // A change on screen: the link shows the saved version until it is shared again.
  await results.getByLabel("Nome do cenário").fill("Revenda Cascais");
  await expect(share.getByText(/Tem alterações por guardar/)).toBeVisible();
  const again = page.waitForEvent("popup");
  await share.getByRole("button", { name: "WhatsApp" }).click();
  await (await again).close();
  await expect(share.getByText(/Tem alterações por guardar/)).toHaveCount(0);
  await expect(share.getByLabel("Link só de leitura")).toHaveValue(link);
  await visitor.reload();
  await expect(
    visitor.getByRole("heading", { name: "Cenário partilhado: Revenda Cascais" }),
  ).toBeVisible();

  // Turning the link off: whoever has it can no longer open it.
  await share.getByRole("button", { name: "Desativar link" }).click();
  await expect(share.getByText(/Link desativado/)).toBeVisible();
  const response = await visitor.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  expect(response?.status()).toBe(404);
  await visitor.close();
});
