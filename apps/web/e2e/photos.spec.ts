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

  // Before saving, photos cannot be added yet.
  const photos = step(page, "Resultados").getByRole("region", { name: "Fotografias do imóvel" });
  await expect(photos.getByText(/Guarde o cenário para adicionar/)).toBeVisible();

  await saveSignedIn(page, `e2e+photos${Date.now()}@example.pt`, LOG!);
  const scenarioId = /cenario=(\d+)/.exec(page.url())![1]!;
  await expect(photos.getByText(/^0 de 30 fotografias · 0 de 5 MB$/)).toBeVisible();

  // Two photos and one file that is not an image.
  await photos.locator('input[type="file"]').setInputFiles([
    { name: "sala.jpg", mimeType: "image/jpeg", buffer: await jpeg("#4a8") },
    { name: "cozinha.jpg", mimeType: "image/jpeg", buffer: await jpeg("#a84") },
    { name: "notas.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") },
  ]);
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
  expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2);
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

  // Delete one; it stays deleted after a reload.
  await photos.getByRole("button", { name: "Apagar fotografia 1" }).click();
  await expect(photos.getByRole("img")).toHaveCount(1);
  await page.reload();
  await expect(
    step(page, "Resultados")
      .getByRole("region", { name: "Fotografias do imóvel" })
      .getByRole("img"),
  ).toHaveCount(1);

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
