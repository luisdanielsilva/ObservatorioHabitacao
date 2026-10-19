import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  chooseDeals,
  clearRateLimits,
  downloadReport,
  field,
  fillPropertyByHand,
  nextPanel,
  pdfText,
  saveSignedIn,
  shareInDb,
  showResults,
  signInWithLink,
  step,
  WATERMARK,
} from "./helpers";

/** Emailing and clean reports need a signed-in user (magic link from the server log). */
const LOG = process.env.E2E_SERVER_LOG;
const MAPS = "https://maps.app.goo.gl/e2eCascais123";

test.skip(!LOG, "set E2E_SERVER_LOG to the dev server log to sign in");

/** The resale of the T2 in Cascais, at the results. */
async function resale(page: Page) {
  await page.goto("/avaliar");
  await fillPropertyByHand(page, "400000", MAPS);
  await chooseDeals(page, "Compra e revenda");
  await nextPanel(page);
  await field(page, "Preço de venda após obras").fill("480000");
  await showResults(page);
}

test("the report: watermarked signed out; signed in, clean and emailed to two addresses, 5 an hour", async ({
  page,
}) => {
  const email = `e2e+share${Date.now()}@example.pt`;
  clearRateLimits("report-pdf:");
  await resale(page);
  // A strategy added from the results is in the report with the others (issue #11).
  const results = step(page, "Resultados");
  const add = results.getByRole("region", { name: "Juntar outra estratégia" });
  await add.getByRole("button", { name: "Arrendamento de longa duração" }).click();
  await field(page, "Renda mensal esperada").fill("1600");
  await add.getByRole("button", { name: "Ver resultados" }).click();
  await expect(page.getByRole("tab", { name: "Arrendamento de longa duração" })).toBeVisible();

  // Signed out: the PDF has the watermark on every page.
  const share = results.getByRole("region", { name: "Partilhar resultados" });
  const anonymous = await downloadReport(page, share);
  for (const text of anonymous.texts) expect(text).toContain(WATERMARK);

  // Signing in comes back to the evaluation, now with the email option.
  await share.getByRole("link", { name: "Entrar →" }).click();
  await signInWithLink(page, email, LOG!);
  await expect(page).toHaveURL(/\/avaliar$/);
  await expect(
    share.getByText(`Vai para ${email} e, se quiseres, para mais um endereço.`),
  ).toBeVisible();
  await expect(share.getByText(/marca de água/)).toHaveCount(0);

  // The PDF is clean, names who made it and when on every page, and links to the site.
  const report = await downloadReport(page, share);
  expect(report.name).toMatch(/^observatorio-habitacao-apartamento-t2-em-.+\.pdf$/);
  expect(report.texts.join(" ")).toMatch(/Indicador\s+Revenda\s+Arrendamento/);
  for (const text of report.texts) {
    expect(text).not.toContain(WATERMARK);
    expect(text).toMatch(/Gerado em \d{1,2} de \S+ de \d{4}( às|,) \d{2}:\d{2}/);
    expect(text).toContain(`por Teste E2E · ${email}`);
    expect(text).toContain("Observatório Habitação ·");
  }
  // The location opens in Google Maps, and the site's address is a link on every page.
  const raw = report.raw.toString("latin1");
  expect(raw).toContain(`/URI (${MAPS})`);
  const links = raw.match(/\/URI \(https?:\/\/[^)]+\)/g) ?? [];
  expect(links.filter((l) => !l.includes(MAPS)).length).toBe(report.texts.length);
  expect(raw).not.toContain("/partilha/");

  // Email: to the account, and one more address if given; a wrong address is refused.
  clearRateLimits("report-email:");
  const extra = share.getByLabel("Outro email (opcional)");
  await extra.fill("banco");
  await share.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(share.getByText(/não parece válido/)).toBeVisible();
  await extra.fill("banco@example.pt");
  await share.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    share.getByText(`Relatório enviado para ${email} e banco@example.pt.`),
  ).toBeVisible();
  await expect(extra).toHaveValue("");
  const log = () => readFileSync(LOG!, "utf8");
  for (const to of [email, "banco@example.pt"]) {
    expect(log()).toMatch(
      new RegExp(
        `to=${to.replace(/[.+]/g, "\\$&")} subject="Relatório do Observatório Habitação: `,
      ),
    );
  }
  const sent = log().slice(log().lastIndexOf("to=banco@example.pt subject="));
  expect(sent).toContain(`Teste E2E (${email}) enviou-te o relatório em PDF`);
  expect(sent).toContain("(1 attachment(s))");
  expect(sent.slice(0, sent.indexOf("attachment"))).not.toContain("/partilha/");

  // The free plan: 5 emails an hour (the invalid one was not counted), and no saving.
  for (let i = 2; i <= 5; i++) {
    await share.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(share.getByText(`Relatório enviado para ${email}.`)).toBeVisible();
  }
  await share.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(share.getByText(/limite de 5 envios por hora/)).toBeVisible();
  await expect(share.getByRole("link", { name: "Fala connosco para aderir →" })).toBeVisible();

  const bar = results.getByRole("region", { name: "Guardar cenário" });
  await bar.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(bar.getByText("Guardar cenários faz parte do plano pago.")).toBeVisible();
  await expect(page).not.toHaveURL(/cenario=/);
  await expect(
    results
      .getByRole("region", { name: "Fotografias do imóvel" })
      .getByText(/Juntar as tuas fotografias ao cenário faz parte do plano pago/),
  ).toBeVisible();
});

test("read-only links made before keep working, watermarked for visitors, until turned off", async ({
  page,
  browser,
}) => {
  const email = `e2e+oldlink${Date.now()}@example.pt`;
  await resale(page);
  await saveSignedIn(page, email, LOG!);
  const scenarioId = /cenario=(\d+)/.exec(page.url())![1]!;
  const token = shareInDb(scenarioId);

  // Anyone with the link sees the results, read-only, with the sale chart.
  const visitor = await browser.newPage();
  await visitor.goto(`/partilha/${token}`);
  await expect(visitor.getByRole("heading", { name: /^Cenário partilhado: / })).toBeVisible();
  await expect(visitor.getByRole("region", { name: "Preço de venda e lucro" })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Abrir no Google Maps" })).toHaveAttribute(
    "href",
    MAPS,
  );
  await expect(visitor.getByRole("textbox")).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);
  // Its PDF never names the owner, and has the watermark for a visitor not signed in.
  const shared = await pdfText(
    await (await visitor.request.get(`/api/partilha/${token}/pdf`)).body(),
  );
  expect(shared.join(" ")).not.toContain(email);
  for (const text of shared) expect(text).toContain(WATERMARK);

  // The owner turns it off from the account; whoever has it can no longer open it.
  await page.goto("/conta");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText(/link só de leitura criado antes/)).toBeVisible();
  await page.getByRole("button", { name: "Desativar link" }).click();
  await expect(page.getByRole("button", { name: "Desativar link" })).toHaveCount(0);
  expect((await visitor.goto(`/partilha/${token}`))?.status()).toBe(404);
  await visitor.close();
});
