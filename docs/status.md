# OlhoVivo — Status

Updated 2026-10-14, against [product-spec.md](product-spec.md) version 2. Known-good restore
point: git tag `good-2026-10-04` (`git rev-parse good-2026-10-04` shows its commit).

Legend: ✅ done · 🟡 partly done · ⬜ not started · ⏩ done ahead of its phase · 👤 needs the
project owner or an outside expert

Tests: 226 unit tests (64 engine, 92 db, 70 web) and 34 end-to-end tests (Playwright, Chromium;
sign-in and photo tests need `E2E_SERVER_LOG`), all passing. Safari/WebKit cannot run on the
VPS (system libraries need sudo), so Safari is untested.

## Latest changes (2026-10-04 – 2026-10-14)

**The agency's commission, in view (2026-10-14)**

- The commission on the sale (default 5 % + VAT) was only in the collapsed "Pressupostos". It is
  now a field next to the sale price in the resale and short-term rental panels, and the
  commission on the premium next to the assignment price, each showing what it comes to in
  euros with VAT. The PDF lists the rates with the inputs, and the gain table names the rate.

**The IRS on a sale's gain, explained (2026-10-14)**

- Each deal's details (results page and PDF) have a block "IRS sobre a mais-valia" at the
  price entered: sale price, commission, purchase price, IMT/stamp duty/deed and works, the
  gain, the share taxed (50 %) and the IRS, with notes on the brackets the gain falls in, the
  holding costs that are not deducted, and other taxable income left blank (lowest bracket).
  Contract assignments get the same, with their own lines.
- The PDF waterfall's bar is now "IRS mais-valia", with a small note under the chart when it
  is drawn at another price (the break-even) than the one entered.
- The engine returns the figures (`ScenarioResult.gainTax`: lines, gain, taxable share, IRS
  per bracket), so the explanation and the tax in the cash flow are the same calculation.

**Photos on the read-only link, by choice; address search removed (2026-10-12)**

- Sharing has a new option, "Mostrar as fotografias do imóvel no link e no seu PDF" (on the
  results and on `/conta`), off by default. When ticked, the read-only page shows the uploaded
  photos and its PDF has them as the owner's does (or the listing's photos when none are
  uploaded). Unticking, or turning the link off, hides them at once; a new link starts without
  them. Migration 0005 adds `scenarios.share_photos`.
- Removed the unused `/api/geocode` route and its OpenStreetMap (Nominatim) search, with the
  OpenStreetMap credit in the footer and on `/metodologia`.

**Google Maps link (2026-10-09)**

- Location: an optional "Link do Google Maps" field (only Google Maps addresses accepted, with
  "Abrir no Google Maps"); reading a listing fills it from the listing's coordinates.
- PDF: a clickable "Mapa · Abrir no Google Maps" row; the read-only page has the link too.
- PDF: nightly price and occupancy on separate rows (they did not fit on one).
- PDF made consistent: every total in bold (purchase costs too), grey labels and black values
  in lists and tables alike, tables flush with the lists on both sides, no words split with
  hyphens, and the listing link clickable ("Abrir anúncio (imovirtual.com)").
- PDF deal sections: a waterfall per deal (initial payment, income, costs, loan payments,
  taxes, sale, result), calculated with the sale at the lowest price without a loss, so it
  ends at 0;
  beside it, on its own larger scale and the same zero line, the profit at each 5 % step above
  that price, stacked in shades, each labelled with its sale price and profit
  ("+20%: 357 409 € -> 49 288 €"). The separate
  steps list was removed from the PDF (the site keeps it). Page 2's "Resumo do cálculo" stays
  at the price entered.

**PDF layout and sale steps (2026-10-08)**

- PDF: page 1 the property; page 2 the whole summary (results side by side, purchase and yearly
  costs, calculation summary, tax note, disclaimer); then one section per deal (sale price
  steps and its alerts, in small type), two deals per page. Checked with four deals and a loan.
- Sale price steps only up to +20 % (0, 5, 10, 15, 20 %), on the site and in the PDF.
- Alerts in smaller type on the site too.
- "Comprar" removed from the menu, with its placeholder page (`/comprar` is now "not found").

**Listing photos and data from the link (2026-10-07)**

- The link reader also reads the listing JSON Imovirtual embeds in its page: area, condition,
  extras, parish (by name and coordinates) and up to 12 photos. The photos' addresses are kept
  with the evaluation (only https on the listing's image server, `olxcdn.com`).
- The owner's PDF uses the uploaded photos or, when there are none, the listing's photos,
  downloaded when the PDF is made (time and size limits); the photos section says so.
- The development example is now a real listing (a new T1 in Braga) with its photos.

**Costs, maintenance, photos in the PDF, sign-in link in development (2026-10-07)**

- Resale: IMI, condominium and insurance are shown for the months until the sale ("Custos até à
  venda (6 meses)"), as the calculation already counted them; rentals show a typical year.
- Maintenance in operating costs: 10 % of the rent (long-term rental, was 5 %) and 20 % of the
  revenue (AL, new); both editable in the assumptions and shown in the yearly costs. Saved
  scenarios keep their long-term rate; saved AL scenarios now include the 20 %.
- PDF: the main photo (the first uploaded) large on page 1, with up to five more, smaller.
- Development without an email provider: the "check your email" page shows the sign-in link.

**Sale price in 5 % steps; example for development (2026-10-07)**

- "Preço de venda e lucro" shows the net profit in 5 % steps from the lowest price without a
  loss, up to +40 %, as bars (on the results, the read-only page and in the PDF), instead of
  the line chart. When no price makes a loss, the steps start from the price entered. The step
  at the price entered is marked.
- Development only: "Preencher exemplo (dev)" and `/avaliar?exemplo=1` load a complete
  evaluation (all four deals, loan, works) and open the results; not in the production build.

**PDF report opens in a new tab (2026-10-07)**

- "Ver PDF" opens the report in a new browser tab (saving the evaluation first if needed);
  the download on `/conta` still saves the file.
- Property summary adds the listing link and the asking price against the market value.
- New "Resumo do cálculo": per deal, every flow of money over its period (initial payment,
  rents, operating costs, works, loan payments, IRS, sale or assignment, loan repayment, IRS on
  the gain) adding up to the result. Long values wrap in their column.

**Property photos: choose before sending (2026-10-06)**

- "Adicionar fotografias" works before the evaluation is saved. Picked photos are reduced in
  the browser (at most 1600 px, WebP) and shown for review: preview, size before and after,
  and a tick to keep or leave out each one; the panel shows what is left of the scenario's
  30 photos / 5 MB and blocks a selection that does not fit.
- Sending saves the evaluation first, as on screen (signing in if needed; after signing in the
  photos have to be chosen again).

**Sharing the results (2026-10-06)**

- **Email, WhatsApp, Facebook Messenger and "Enviar para o email da conta"** all send a
  read-only link to the evaluation (`/partilha/<token>`). "Ver PDF" downloads the full report.
- **Saved first:** each option saves the evaluation as on screen (signing in if needed) and
  turns its link on, so the link always shows what the user sees. The link stays the same
  across saves; a note says when there are unsaved changes; it can be turned off.
- **Channels:** email opens the mail app (`mailto:`); WhatsApp opens `wa.me` in a new tab;
  Messenger opens the app on phones (`fb-messenger://`) and, on computers, copies the link and
  opens messenger.com; the account email is sent by OlhoVivo (10 emails a day, shared with the
  report emails).
- **First save no longer reloads the page** (the address changes to `?cenario=<id>`).
- **PDF report complete:** yearly costs per deal, the sale price and profit chart per deal and
  the property photos (owner's PDF only; not in the PDF behind the read-only link).
- **Read-only page** shows the sale price and profit chart too.

**Avaliar anúncio, a four-step flow**

1. **Property:** paste a listing link (read for you) or fill in by hand. Price, typology (homes
   only), area and location (at least the municipality) are required.
2. **Deal type:** one or more of buy and resell, long-term rental, short-term rental (AL),
   contract position sale.
3. **Details:** a shared panel (purchase and works, property use, financing, other income, IMI/VPT
   and selling assumptions), then one panel per deal. Missing fields are shown in red, with a
   message and the focus on the first one.
4. **Results:** per deal headline figures; purchase costs line by line; yearly costs; the sale
   price and profit chart; the side-by-side comparison; the scenario name and save; photos;
   sharing.

**Calculation**

- **Taxes:** IRS by brackets, not a fixed rate: sale gains (50 %), AL income and aggregated rents
  are added to the user's optional other annual income (CIRS art. 68 and 68-A, brackets in the
  versioned parameters). A note says when aggregating rents can beat the 25 % flat rate.
- **Long-term rental:** kept for good (no sale), measured over 30 years or the loan term;
  consecutive leases separated by a vacancy in months; its own condominium (25 €/month) and home
  insurance (20 €/month); yearly rent increase defaults to the latest legal rent update
  coefficient (2026: 2.24 %, Aviso n.º 23174/2025/2).
- **Rental results:** monthly, annual and lifetime cash flow and annual return on capital; no
  profit, ROI or IRR for a property that is kept.
- **Financing:** none by default. With a loan: amount = most banks lend for the use (90 % own
  home, 80 % otherwise); rate = TAEG as the global rate; term 30 years, at most 50.
- **Purchase costs:** IMT, stamp duty on the purchase and on the loan, Casa Pronta (deed and
  registration), bank valuation (250 €) and process opening (300 €).
- **Yearly costs** (IMI, condominium, insurance) shown explicitly.
- **No appreciation:** sales are at today's value. No utilities while holding a resale.
- **Sale price chart:** lowest sale price without a loss and profit above it, per deal.
- **No ranking:** no goals and no "best option"; deals are compared side by side and only the
  indicators that apply are shown.

**Site**

- **Home page:** the listing-link box first, "Idealista.pt e Imovirtual.com suportados", and
  manual entry.
- **Link reader:** Claude reads the page when `ANTHROPIC_API_KEY` is set (structured data
  otherwise); only allow-listed sites (`.env.local`: imovirtual.com, imovirtual.pt).
- **Language:** always opens in Portuguese (no browser-language redirect); pages ask browsers
  not to machine-translate them.
- **Evaluation kept in the browser** while moving around the site; restored on return; saved
  automatically after signing in to save; "Nova avaliação" starts over.
- **Photos of saved scenarios:** up to 30 or 5 MB per scenario; re-encoded to WebP, max
  1600 px, metadata (GPS) removed; owner only; deleted with the scenario or the account.

## Phase 0 — Foundations

| WBS       | Item                               | Status | Notes                                                                 |
| --------- | ---------------------------------- | ------ | --------------------------------------------------------------------- |
| 1         | Project management                 | 🟡     | Plan, WBS and this status in `docs/`; no backlog/issue tracker        |
| 2.2       | Brand identity, domain, trademark  | ⬜ 👤  | No logo; olhovivo.pt not registered                                   |
| 2.3.1     | Scenario formulas and assumptions  | 🟡 👤  | `packages/engine/METHODOLOGY.md`; needs accountant review             |
| 2.3.2     | Default values and editable inputs | ✅     | Defaults in `lib/calculator/state.ts`, editable as assumptions        |
| 2.3.3     | Reference spreadsheet              | ⬜ 👤  | Engine tests use developer-worked examples                            |
| 2.4       | UX/UI design                       | ⬜     | Built directly with shadcn/ui; no separate mockups                    |
| 3.1       | Environments, VPS                  | 🟡     | Dev server on the Tailscale address only (100.93.94.115:3100)         |
| 3.2.1     | Git repository                     | ✅     | Local repo, branch `main`; **no remote, nothing pushed**              |
| 3.2.2     | CI pipeline                        | 🟡     | `.github/workflows/ci.yml` written; runs once pushed to GitHub        |
| 3.2.3     | Deployment script (systemd)        | 🟡 👤  | `deploy/` ready (pull, install, backup, migrate, build); needs sudo   |
| 3.3.1     | SQLite, WAL, R*Tree                | ✅     | WAL; R*Tree used for the parish lookup                                |
| 3.3.2     | Cache and job tables               | 🟡     | `cache` used (rate limits, listings); no job worker yet               |
| 3.3.3     | File storage                       | ✅     | Photos on disk under `data/photos/` (`PHOTOS_DIR`); no object storage |
| 3.4       | Logging, backups, SSL              | 🟡 👤  | Nightly `.backup` ready; Nginx/SSL with the deployment                |
| 10.1–10.2 | Company setup, RGPD                | ⬜ 👤  |                                                                       |
| 10.6      | Tax/legal review of scenario rules | ⬜ 👤  | Open questions in METHODOLOGY.md                                      |

## Phase 1 — MVP

| WBS         | Item                                   | Status | Notes                                                                                                         |
| ----------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| 4.1         | Database schema, location hierarchy    | ✅     | Plus `scenario_photos` (migration 0004)                                                                       |
| 4.2.1       | INE sale and rent medians              | ✅     | Sale €/m² quarterly 2019–2026; rent €/m² yearly 2020–2025                                                     |
| 4.2.2       | CAOP boundaries                        | ✅     | CAOP 2025                                                                                                     |
| 4.2.3       | Tax and financing sources              | 🟡 👤  | Euribor monthly (ECB); rent update coefficients (`import:rents`); 2025 set active, 2026 draft; all unverified |
| 4.3.1–4.3.2 | Import scripts, cleaning               | ✅     | `npm run import:all` (incl. rent updates)                                                                     |
| 4.3.3       | Geocoding, freguesia lookup            | ✅     | Parish by CAOP boundary (listing coordinates) or by name; address search removed (location by dropdowns)      |
| 4.3.4       | Link reader                            | 🟡 👤  | Claude + structured-data fallback; Imovirtual allowed; no API key yet; Idealista blocks servers               |
| 4.3.5       | Scheduling and failure handling        | 🟡     | systemd timers prepared; not installed                                                                        |
| 4.4.1–4.4.3 | Median prices/rents, history           | ✅     |                                                                                                               |
| 4.5.1       | IMT, stamp duty, Casa Pronta           | ✅     | Values unverified                                                                                             |
| 4.5.2       | IMI per municipality                   | 🟡 👤  | 2023–2025 rates for 300 municipalities (transcribed, unverified); price used when VPT unknown                 |
| 4.5.3       | Rental, AL and capital gains tax rules | ✅     | IRS brackets 2025 (active) and 2026 (draft); unverified                                                       |
| 4.5.4       | Financing                              | ✅     | Euribor + spread default; LTV limits; TAEG                                                                    |
| 4.5.5       | Yearly update process                  | ✅     | Draft → verify → activate in `/admin/parametros`                                                              |
| 5.3.1–5.3.6 | Scenarios, comparison                  | ✅     | Several deals per evaluation; side by side, no ranking                                                        |
| 5.4         | Opportunity score                      | ✅     | Asking price vs. market value, ±5 %                                                                           |
| 5.5         | Listing assessment flow                | ✅     | Four steps                                                                                                    |
| 6.1         | Auth                                   | ✅     | Magic link (Resend or server log); Google when configured                                                     |
| 6.2.2–6.2.5 | Endpoints                              | ✅     | analyze, reference, prices, areas, scenarios (PDF, photos)                                                    |
| 7.1–7.2.8   | Foundations and public pages           | ✅     | Portuguese by default; home page with the link box                                                            |
| 7.2.9       | About, contacts, legal pages           | 🟡 👤  | Draft texts; need legal review                                                                                |
| 7.4.1       | Responsiveness, accessibility          | 🟡     | Phone layout tested; labels, required/invalid fields, focus; no WCAG audit                                    |
| 7.4.2       | Performance                            | ⬜     | No Lighthouse / Core Web Vitals check                                                                         |
| 11.3        | Engine vs. reference spreadsheet       | 🟡 👤  | Spreadsheet pending                                                                                           |

## Phase 2 — Engagement

| WBS         | Item                       | Status | Notes                                                                                        |
| ----------- | -------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| 5.3.7       | Sale-price analysis        | ✅     | Replaced the sensitivity sliders: break-even sale price and profit in 5 % steps above it     |
| 6.3.1       | Favourites, saved searches | ⬜     | Tables only (Phase 3 with Comprar)                                                           |
| 6.3.2       | Saved scenarios            | ✅     | Save, duplicate, open and delete (`/conta`); photos; draft kept in the browser               |
| 6.3.3       | PDF report                 | ✅     | Opens in a new tab; calculation summary, yearly costs, sale charts, photos (owner only)      |
| 6.3.4       | Sharing                    | ✅     | Read-only link by email, WhatsApp, Messenger, account email; photos opt-in; also on `/conta` |
| 6.3.5       | Alerts engine              | ⬜     | Not started                                                                                  |
| 6.4.1–6.4.2 | Leads, team notifications  | ✅     |                                                                                              |
| 7.3         | Private area               | ✅     | `/conta`; data export includes photo details                                                 |
| 8.1–8.5     | Admin back-office          | ✅     |                                                                                              |
| 8.6         | Analytics dashboard        | 🟡     | `logEvent` is never called: event counts stay empty                                          |
| 9           | Content, SEO               | 🟡     | `/metodologia`; no analytics or conversion tracking                                          |
| 10.2        | Cookie consent             | 🟡 👤  | `/cookies` page; no banner (only essential cookies and browser storage for the draft so far) |
| 11.5        | End-to-end tests           | ✅     | 34 tests                                                                                     |

## Known gaps

- **Idealista is advertised as supported but cannot be read:** it blocks server requests (403
  bot protection) and is not on the allow-list; its links get "fill in by hand". Kept on the
  home page by the owner's decision.
- **Link reader without AI:** no `ANTHROPIC_API_KEY` yet, so only the page's structured data is
  used. For Imovirtual this includes the listing JSON the page embeds: price, area, type,
  typology, condition, extras, parish and photos.
- **Listing photos are not shown on the site** (only counted): the site's content security
  policy does not load images from other servers. They are used in the owner's PDF.
- **Listing photos are not on the read-only page** even when photos are shared (same content
  security policy); only uploaded ones are. Its PDF has them.
- **Messenger on a computer** cannot be pre-filled without a Facebook app id: the link is copied
  and messenger.com opened for the user to paste it.
- **Default interest rate is an estimate** (Euribor + typical spread), lower than a real TAEG.
- **Loan term up to 50 years,** while Banco de Portugal guidance caps new mortgages at 40.
- **IMI uses the price when the VPT is unknown,** which overstates it (a warning is shown).
- **Long-term rental horizon of 30 years** is an assumption; its sale chart assumes a sale then.
- **Tax year:** the 2025 parameter set is active; 2026 is a draft awaiting review.
- **Draft per browser:** an unsaved evaluation does not follow the user to another device.
- **Untested in Safari.**

## Open points

**Decisions and outside help (👤)**

1. Accountant review: formulas, 2025/2026 tax parameters, IRS brackets, IMI rates, TAEG and
   purchase-cost assumptions; then activate the 2026 set.
2. Legal: terms, privacy, cookies (is a banner needed?), reading listing sites (Imovirtual terms;
   Idealista), using listing photos in the owner's PDF, AMI licence if commissions are taken.
3. Brand and domain (olhovivo.pt), trademark.
4. `ANTHROPIC_API_KEY` for the AI link reader.
5. GitHub remote (enables CI); sudo for the deployment (systemd, Nginx, backups, timers).
6. Loan term limit: 50 years (as now) or 40 (Banco de Portugal).

**Development**

1. Record analytics events (`logEvent`) for searches, evaluations, saves and leads.
2. Alerts engine (6.3.5).
3. Accessibility audit (axe in the e2e tests) and Lighthouse / Core Web Vitals.
4. When INE's 2027 rent update coefficient is published (by 30 October 2026): add it to
   `packages/db/src/import/rentUpdate.ts` and run `npm run import:rents`.
5. Buyers aged 35 or under: ask the buyer's age (or "35 or under") and, for an own permanent
   home, apply the young buyers' support: no IMT and no stamp duty on the purchase up to the
   legal price limit (partial above it), and up to 100 % financing with the State's public
   guarantee. Limits and conditions to confirm with the accountant (open point 1 above).
6. Comparable listings: for each listing analysed, find at least 5 other listings with the same
   characteristics (type, bedrooms, similar area and condition, same parish or nearby) and
   compare the asking price and €/m² with them (median, range, where this one stands). Needs a
   source of listings (reading listing sites: see the legal open point 2 above).

**On each deployment**

- Migrations run in `deploy/deploy.sh`.
- Only for a database created before 2026-10-04 (e.g. an older copy moved to a new server):
  `npm run params:irs -w @olhovivo/db` adds the IRS brackets to its stored tax parameters, and
  `npm run import:rents -w @olhovivo/db` loads INE's yearly rent update coefficients. The
  current database (`data/olhovivo.db`) already has both.
- Each year, once INE's new rent update coefficient is added (development point 4), run
  `npm run import:rents -w @olhovivo/db` again.
- Back up `data/photos/` with the VPS backup (photos are files, not in the database).

## Changed by decisions since plan v2

- **No automatic estimates in v1;** the user enters market values, INE medians as reference.
- **No Python, Redis, SpatiaLite or Docker.**
- **Link reader in the MVP,** read with Claude.
- **No ranking of strategies:** the spec's "best one highlighted according to the user's goal"
  was dropped — the user compares and decides.
- **Long-term rental is kept for good** (no holding period, no sale).
- **No appreciation;** sales at today's value.
- **Sensitivity sliders replaced** by the sale-price analysis.
- **Location by dropdowns only** in manual entry (address search removed).
- **No "Comprar" in the menu:** property search is not planned for now; the page was removed
  (2026-10-08).
