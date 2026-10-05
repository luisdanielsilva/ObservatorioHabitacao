# OlhoVivo — Status

Updated 2026-10-05, against [product-spec.md](product-spec.md) version 2. Known-good restore
point: git tag `good-2026-10-04` (moved to `cfec12a` on 2026-10-05).

Legend: ✅ done · 🟡 partly done · ⬜ not started · ⏩ done ahead of its phase · 👤 needs the
project owner or an outside expert

Tests: 193 unit tests (56 engine, 91 db, 46 web) and 29 end-to-end tests (Playwright, Chromium;
sign-in and photo tests need `E2E_SERVER_LOG`), all passing. Safari/WebKit cannot run on the
VPS (system libraries need sudo), so Safari is untested.

## Latest changes (2026-10-04 – 2026-10-05)

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
   sharing (mock-up).

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
| 4.3.3       | Geocoding, freguesia lookup            | 🟡     | Built, but address search removed from the UI (location by dropdowns); `/api/geocode` unused                  |
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
| 5.3.7       | Sale-price analysis        | ✅     | Replaced the sensitivity sliders: break-even sale price and profit above it                  |
| 6.3.1       | Favourites, saved searches | ⬜     | Tables only (Phase 3 with Comprar)                                                           |
| 6.3.2       | Saved scenarios            | ✅     | Save, duplicate, open and delete (`/conta`); photos; draft kept in the browser               |
| 6.3.3       | PDF report                 | 🟡     | Works from `/conta`; lacks yearly costs, the sale chart and photos                           |
| 6.3.4       | Sharing                    | 🟡     | Evaluate page: email/WhatsApp/Messenger/PDF **mock-ups**; working sharing only on `/conta`   |
| 6.3.5       | Alerts engine              | ⬜     | Not started                                                                                  |
| 6.4.1–6.4.2 | Leads, team notifications  | ✅     |                                                                                              |
| 7.3         | Private area               | ✅     | `/conta`; data export includes photo details                                                 |
| 8.1–8.5     | Admin back-office          | ✅     |                                                                                              |
| 8.6         | Analytics dashboard        | 🟡     | `logEvent` is never called: event counts stay empty                                          |
| 9           | Content, SEO               | 🟡     | `/metodologia`; no analytics or conversion tracking                                          |
| 10.2        | Cookie consent             | 🟡 👤  | `/cookies` page; no banner (only essential cookies and browser storage for the draft so far) |
| 11.5        | End-to-end tests           | ✅     | 29 tests                                                                                     |

## Known gaps

- **Idealista is advertised as supported but cannot be read:** it blocks server requests (403
  bot protection) and is not on the allow-list; its links get "fill in by hand". Kept on the
  home page by the owner's decision.
- **Link reader without AI:** no `ANTHROPIC_API_KEY` yet, so only the page's structured data is
  used (Imovirtual: price, type, typology, location; often no area).
- **Sharing on the evaluate page is a mock-up;** the PDF lacks yearly costs, the sale chart and
  photos; photos are not on the public share page.
- **Default interest rate is an estimate** (Euribor + typical spread), lower than a real TAEG.
- **Loan term up to 50 years,** while Banco de Portugal guidance caps new mortgages at 40.
- **IMI uses the price when the VPT is unknown,** which overstates it (a warning is shown).
- **Long-term rental horizon of 30 years** is an assumption; its sale chart assumes a sale then.
- **Tax year:** the 2025 parameter set is active; 2026 is a draft awaiting review.
- **Draft per browser:** an unsaved evaluation does not follow the user to another device.
- **Unused code:** `/api/geocode` (address search removed from the UI).
- **Untested in Safari.**

## Open points

**Decisions and outside help (👤)**

1. Accountant review: formulas, 2025/2026 tax parameters, IRS brackets, IMI rates, TAEG and
   purchase-cost assumptions; then activate the 2026 set.
2. Legal: terms, privacy, cookies (is a banner needed?), reading listing sites (Imovirtual terms;
   Idealista), AMI licence if commissions are taken.
3. Brand and domain (olhovivo.pt), trademark.
4. `ANTHROPIC_API_KEY` for the AI link reader.
5. GitHub remote (enables CI); sudo for the deployment (systemd, Nginx, backups, timers).
6. Loan term limit: 50 years (as now) or 40 (Banco de Portugal).

**Development**

1. Real sharing (email, WhatsApp, Messenger, PDF view/send) in place of the mock-ups.
2. PDF: add yearly costs, the sale chart and photos; photos on the share page (opt-in).
3. Record analytics events (`logEvent`) for searches, evaluations, saves and leads.
4. Alerts engine (6.3.5).
5. Remove or reuse `/api/geocode`.
6. Accessibility audit (axe in the e2e tests) and Lighthouse / Core Web Vitals.
7. When INE's 2027 rent update coefficient is published (by 30 October 2026): add it to
   `packages/db/src/import/rentUpdate.ts` and run `npm run import:rents`.

**On each deployment**

- Migrations run in `deploy/deploy.sh`; once per database: `npm run params:irs` and
  `npm run import:rents` (`-w @olhovivo/db`).
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
