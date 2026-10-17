import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  chooseDeals,
  field,
  fillPropertyByHand,
  nextPanel,
  saveSignedIn,
  showResults,
  step,
} from "./helpers";

const LOG = process.env.E2E_SERVER_LOG;
/** Where the dev server keeps photos (next to the database, as in lib/photos). */
const PHOTOS_DIR = path.resolve(__dirname, "../../../data/photos");

test.skip(!LOG, "set E2E_SERVER_LOG to the dev server log to sign in");

const jpeg = (colour: string) =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: colour } })
    .jpeg({ quality: 90 })
    .withMetadata({ exif: { IFD0: { Make: "TestCam" } } })
    .toBuffer();

test("photos: added to a saved scenario, listed, deleted, and gone with the scenario", async ({
  page,
  browser,
}) => {
  await page.goto("/avaliar");
  await fillPropertyByHand(page);
  await chooseDeals(page, "Compra e revenda");
  await nextPanel(page);
  await field(page, "Preço de venda após obras").fill("480000");
  await showResults(page);

  // Before saving, photos can be chosen; sending them will save the scenario.
  const photos = step(page, "Resultados").getByRole("region", { name: "Fotografias do imóvel" });
  await expect(photos.getByText(/ao enviá-las, o cenário é guardado/)).toBeVisible();
  await expect(photos.getByRole("button", { name: "Adicionar fotografias" })).toBeEnabled();

  await saveSignedIn(page, `e2e+photos${Date.now()}@example.pt`, LOG!);
  const scenarioId = /cenario=(\d+)/.exec(page.url())![1]!;
  await expect(photos.getByText(/^0 de 30 fotografias · 0 de 5 MB$/)).toBeVisible();

  // Two photos and one file that is not an image: reviewed before they are sent.
  await photos.locator('input[type="file"]').setInputFiles([
    { name: "sala.jpg", mimeType: "image/jpeg", buffer: await jpeg("#4a8") },
    { name: "cozinha.jpg", mimeType: "image/jpeg", buffer: await jpeg("#a84") },
    { name: "notas.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") },
  ]);
  const review = photos.getByRole("group", { name: "Fotografias a enviar" });
  await expect(review.getByRole("checkbox")).toHaveCount(3);
  await expect(review.getByText(/^Reduzida: .+ → .+\skB$/)).toHaveCount(2);
  await expect(review.getByText("Sem pré-visualização")).toBeVisible();
  await expect(review.getByText(/^3 selecionadas/)).toBeVisible();
  await review.getByRole("button", { name: "Enviar 3 fotografias" }).click();
  await expect(review).toHaveCount(0);
  await expect(
    photos.getByText(/2 fotografias adicionadas; 1 ficheiro não é uma imagem válida/),
  ).toBeVisible();
  await expect(photos.getByRole("img")).toHaveCount(2);
  await expect(photos.getByText(/^2 de 30 fotografias/)).toBeVisible();

  // Stored small, as WebP, at most 1600 px, without the camera metadata.
  const files = readdirSync(path.join(PHOTOS_DIR, scenarioId));
  expect(files).toHaveLength(2);
  const stored = await sharp(path.join(PHOTOS_DIR, scenarioId, files[0]!)).metadata();
  expect(stored.format).toBe("webp");
  expect(Math.max(stored.width!, stored.height!)).toBeLessThanOrEqual(1600);
  expect(stored.exif).toBeUndefined();

  // Choosing more, and leaving one out.
  await photos.locator('input[type="file"]').setInputFiles([
    { name: "quarto.jpg", mimeType: "image/jpeg", buffer: await jpeg("#48a") },
    { name: "wc.jpg", mimeType: "image/jpeg", buffer: await jpeg("#888") },
  ]);
  await review.getByRole("checkbox", { name: "Enviar wc.jpg" }).click();
  await expect(review.getByText(/^1 selecionada/)).toBeVisible();
  await review.getByRole("button", { name: "Enviar 1 fotografia" }).click();
  await expect(photos.getByText("1 fotografia adicionada.")).toBeVisible();
  await expect(photos.getByRole("img")).toHaveCount(3);

  // Only the owner can see them.
  const src = await photos.getByRole("img").first().getAttribute("src");
  const stranger = await browser.newPage();
  expect((await stranger.request.get(src!)).status()).toBe(401);
  await stranger.close();

  // The owner's PDF report has the photos; the one behind the read-only link does not.
  const pdf = (await (await page.request.get(`/api/scenarios/${scenarioId}/pdf`)).body()).toString(
    "latin1",
  );
  expect(pdf.startsWith("%PDF")).toBe(true);
  expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(3);
  const popup = page.waitForEvent("popup");
  await page.context().route("https://wa.me/**", (r) => r.fulfill({ body: "WhatsApp" }));
  await step(page, "Resultados").getByRole("button", { name: "WhatsApp" }).click();
  await (await popup).close();
  const link = await step(page, "Resultados").getByLabel("Link só de leitura").inputValue();
  const token = link.split("/partilha/")[1];
  const shared = (await (await page.request.get(`/api/partilha/${token}/pdf`)).body()).toString(
    "latin1",
  );
  expect(shared.startsWith("%PDF")).toBe(true);
  expect(shared).not.toContain("/Subtype /Image");

  // Unless the owner chooses to show them: then the read-only page and its PDF have them too.
  const photoId = /\/photos\/(\d+)$/.exec(src!)![1];
  const sharedPhoto = `/api/partilha/${token}/photos/${photoId}`;
  const visitor = await browser.newPage();
  expect((await visitor.request.get(sharedPhoto)).status()).toBe(404);
  const option = step(page, "Resultados").getByRole("checkbox", {
    name: "Mostrar as fotografias do imóvel no link e no teu PDF",
  });
  await expect(option).not.toBeChecked();
  await option.click();
  await expect(option).toBeChecked();
  await visitor.goto(`/partilha/${token}`);
  const gallery = visitor.getByRole("region", { name: "Fotografias do imóvel" });
  await expect(gallery.getByRole("img")).toHaveCount(3);
  expect((await visitor.request.get(sharedPhoto)).status()).toBe(200);
  const withPhotos = (
    await (await visitor.request.get(`/api/partilha/${token}/pdf`)).body()
  ).toString("latin1");
  expect(withPhotos.match(/\/Subtype \/Image/g)).toHaveLength(3);

  // Unticking hides them again at once.
  await option.click();
  await expect(option).not.toBeChecked();
  expect((await visitor.request.get(sharedPhoto)).status()).toBe(404);
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: /^Cenário partilhado: / })).toBeVisible();
  await expect(visitor.getByRole("region", { name: "Fotografias do imóvel" })).toHaveCount(0);
  await visitor.close();

  // Delete one; it stays deleted after a reload.
  await photos.getByRole("button", { name: "Apagar fotografia 1" }).click();
  await expect(photos.getByRole("img")).toHaveCount(2);
  await page.reload();
  await expect(
    step(page, "Resultados")
      .getByRole("region", { name: "Fotografias do imóvel" })
      .getByRole("img"),
  ).toHaveCount(2);

  // The saved scenario can be opened from the account, and deleting it removes its photos.
  await page.getByRole("link", { name: "Os meus cenários" }).click();
  await expect(page).toHaveURL(/\/conta/);
  page.once("dialog", (d) => void d.accept());
  await page
    .getByRole("button", { name: /Apagar/ })
    .first()
    .click();
  await expect.poll(() => existsSync(path.join(PHOTOS_DIR, scenarioId))).toBe(false);
});

test("photos chosen before saving: signed out asks to sign in, signed in saves first", async ({
  page,
}) => {
  const results = async () => {
    await fillPropertyByHand(page);
    await chooseDeals(page, "Compra e revenda");
    await nextPanel(page);
    await field(page, "Preço de venda após obras").fill("480000");
    await showResults(page);
    return step(page, "Resultados").getByRole("region", { name: "Fotografias do imóvel" });
  };
  const choose = (photos: Awaited<ReturnType<typeof results>>, buffer: Buffer) =>
    photos
      .locator('input[type="file"]')
      .setInputFiles([{ name: "sala.jpg", mimeType: "image/jpeg", buffer }]);

  await page.goto("/avaliar");
  let photos = await results();
  await choose(photos, await jpeg("#4a8"));
  await photos.getByRole("button", { name: "Enviar 1 fotografia" }).click();
  await expect(photos.getByText(/Entra na tua conta para guardar o cenário/)).toBeVisible();

  // Signed in, a new evaluation: sending the photo saves it as a new scenario.
  await saveSignedIn(page, `e2e+photos-unsaved${Date.now()}@example.pt`, LOG!);
  const first = /cenario=(\d+)/.exec(page.url())![1]!;
  await page.getByRole("button", { name: "Nova avaliação" }).click();
  photos = await results();
  await choose(photos, await jpeg("#a84"));
  await photos.getByRole("button", { name: "Enviar 1 fotografia" }).click();
  await expect(photos.getByText("1 fotografia adicionada.")).toBeVisible();
  await expect(page).toHaveURL(/cenario=\d+/);
  expect(/cenario=(\d+)/.exec(page.url())![1]).not.toBe(first);
  await expect(photos.getByRole("img")).toHaveCount(1);
  await expect(photos.getByText(/^1 de 30 fotografias/)).toBeVisible();
});
