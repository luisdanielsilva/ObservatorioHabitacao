# OlhoVivo — Status

Updated 2026-10-03 (evening, Phase 2 work in the working tree), against [product-spec.md](product-spec.md) version 2.

Legend: ✅ done · 🟡 partly done · ⬜ not started · ⏩ done ahead of its phase · 👤 needs the
project owner or an outside expert

## Phase 0 — Foundations

| WBS       | Item                               | Status | Notes                                                                |
| --------- | ---------------------------------- | ------ | -------------------------------------------------------------------- |
| 1         | Project management                 | 🟡     | Plan and WBS in `docs/`; no backlog/issue tracker yet                |
| 2.2       | Brand identity, domain, trademark  | ⬜ 👤  | No logo; olhovivo.pt not registered                                  |
| 2.3.1     | Scenario formulas and assumptions  | 🟡 👤  | Drafted in `packages/engine/METHODOLOGY.md`; needs accountant review |
| 2.3.2     | Default values and editable inputs | ⬜     | To decide while building the calculator                              |
| 2.3.3     | Reference spreadsheet              | ⬜ 👤  | Engine tests use developer-worked examples for now                   |
| 2.4       | UX/UI design                       | ⬜     | Building directly with shadcn/ui; no separate mockups                |
| 3.1       | Environments, VPS                  | 🟡     | Developing on the VPS; dev server on the Tailscale address only      |
| 3.2.1     | Git repository                     | ✅     | Local repo, branch `main`; no remote yet                             |
| 3.2.2     | CI pipeline                        | 🟡     | `.github/workflows/ci.yml` written; runs once pushed to GitHub       |
| 3.2.3     | Deployment script (systemd)        | ⬜     |                                                                      |
| 3.3.1     | SQLite, WAL, R*Tree                | 🟡     | WAL on; R*Tree available, not used yet                               |
| 3.3.2     | Cache and job tables               | 🟡     | Tables exist; `cache` used for rate limiting; no job worker yet      |
| 3.4       | Logging, backups, SSL              | ⬜     | Nightly `.backup` + Nginx/SSL with the deployment                    |
| 10.1–10.2 | Company setup, RGPD                | ⬜ 👤  |                                                                      |
| 10.6      | Tax/legal review of scenario rules | ⬜ 👤  | Open questions listed in METHODOLOGY.md                              |

## Phase 1 — MVP

| WBS          | Item                                   | Status | Notes                                                                                                         |
| ------------ | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| 4.1          | Database schema, location hierarchy    | ✅     | Adds `analyses`, `area_boundaries` + R*Tree, `cache`, `jobs`, `reference_rates`                               |
| 4.2.1        | INE sale and rent medians              | ✅     | Sale €/m² quarterly 2019–2026 (306 municipalities, 356 parishes); rent €/m² yearly 2020–2025 (255 / 183)      |
| 4.2.2        | CAOP boundaries                        | ✅     | CAOP 2025: 308 municipalities, 3 259 parishes, simplified boundaries                                          |
| 4.2.3        | Tax and financing sources              | 🟡 👤  | Euribor imported monthly from the ECB; 2025 set corrected, 2026 mainland set as a draft; all unverified       |
| 4.3.1–4.3.2  | Import scripts, cleaning               | ✅     | `npm run import:all`; idempotent; logged in `ingestion_jobs`                                                  |
| 4.3.3        | Address geocoding, freguesia lookup    | ✅     | Nominatim (OSM) + CAOP point-in-polygon; name match fallback                                                  |
| 4.3.4        | Link reader                            | 🟡 👤  | Claude reads the page (`ANTHROPIC_API_KEY`), structured data as fallback; off until the allow-list is decided |
| 4.3.5        | Scheduling and failure handling        | 🟡     | Weekly systemd timer prepared (`deploy/`); not installed yet                                                  |
| 4.4.1–4.4.3  | Median prices/rents, history           | ✅     | District figures derived as the median of municipal medians                                                   |
| 4.5.1        | IMT, Imposto do Selo, notary/registry  | ✅     | Versioned parameter set; values unverified                                                                    |
| 4.5.2        | IMI per municipality                   | 🟡     | 2023–2025 rates for 300 municipalities (transcribed, unverified); fallback 0.3 %                              |
| 4.5.3        | Rental, AL and capital gains tax rules | ✅     | Values unverified                                                                                             |
| 4.5.4        | Euribor, spreads, LTV limits           | ✅     | Default loan rate = 12-month Euribor + typical spread                                                         |
| 4.5.5        | Yearly update process                  | ✅     | Draft → verify → activate in `/admin/parametros`                                                              |
| 5.3.1–5.3.6  | Scenarios, comparison                  | ✅     | User-entered market values; IRR fixed for long series                                                         |
| 5.4          | Opportunity score                      | ✅     | Asking price vs. user's market value, ±5 % band                                                               |
| 5.5          | Listing assessment flow                | ✅     | Link or manual entry → location → INE reference → four scenarios                                              |
| 6.1          | Auth (Auth.js)                         | ✅     | Email magic link (Resend); Google when `AUTH_GOOGLE_*` is set; admins from `ADMIN_EMAILS`; rate-limited       |
| 6.2.2        | Link analysis endpoint                 | ✅     | `POST /api/analyze`, `GET /api/geocode`, `GET /api/reference`                                                 |
| 6.2.3        | Prices and rents endpoints             | ✅     | `GET /api/prices/[...path]`, `GET /api/areas`                                                                 |
| 6.2.5        | Scenario endpoints                     | ✅     | Calculation in the browser; save/duplicate by server actions; PDF route per scenario                          |
| 7.1          | Foundations: i18n, layout, theming     | ✅     | PT/EN, dark default + light, header/footer, 404                                                               |
| 7.2.1        | Home page                              | ✅     |                                                                                                               |
| 7.2.4–7.2.5  | Calculator and comparison view         | ✅     | Table, goal selector, cash-flow chart, details and warnings                                                   |
| 7.2.7        | Avaliar anúncio                        | ✅     | `/avaliar`                                                                                                    |
| 7.2.8        | Preços pages                           | ✅     | Overview + district/municipality/parish pages, ISR, sitemap, JSON-LD                                          |
| 7.2.9        | About, contacts, legal pages           | 🟡 👤  | Draft texts; need legal review                                                                                |
| 7.4.1        | Responsiveness, accessibility          | 🟡     | No horizontal scroll at 375 px; labels, help texts, focus, card titles are headings; no WCAG audit yet        |
| 11.3         | Engine vs. reference spreadsheet       | 🟡 👤  | 162 tests pass (51 engine, 86 db, 25 web); spreadsheet pending                                                |
| 3.2.3, 3.4.2 | Deployment, backups                    | 🟡 👤  | systemd/Nginx/deploy/backup files ready in `deploy/`; installing needs sudo                                   |

## Phase 2 — Engagement (in the working tree, not committed yet)

| WBS         | Item                         | Status | Notes                                                                                      |
| ----------- | ---------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| 5.3.7       | Sensitivity analysis         | ✅     | Price, rent, occupancy, interest; four metrics; chart and table                            |
| 6.3.1       | Favourites, saved searches   | ⬜     | Tables only (Phase 3 with Comprar)                                                         |
| 6.3.2       | Saved scenarios              | ✅     | Save, duplicate, delete; inputs typed before sign-in are restored                          |
| 6.3.3       | PDF report                   | ✅     | React-PDF, for own and shared scenarios                                                    |
| 6.3.4       | Sharing (X, Facebook, email) | ✅     | Public page `/partilha/[token]` with preview image; report by email                        |
| 6.3.5       | Alerts engine                | ⬜     | Not started                                                                                |
| 6.4.1–6.4.2 | Leads, team notifications    | ✅     | Vender requests; email to `TEAM_EMAIL`                                                     |
| 7.3         | Private area                 | ✅     | `/conta`: scenarios, analyses, requests, settings, consents, data export, account deletion |
| 8.1–8.5     | Admin back-office            | ✅     | Sources and imports, parameters, leads/CRM, users                                          |
| 8.6         | Analytics dashboard          | 🟡     | Dashboard built, but `logEvent` is never called, so event counts stay empty                |
| 9           | Content, SEO                 | 🟡     | `/metodologia` with FAQ; no analytics or conversion tracking                               |
| 10.2        | Cookie consent               | 🟡 👤  | `/cookies` page; no banner (only essential cookies so far — confirm with legal review)     |
| 11.5        | End-to-end tests             | ✅     | Playwright, 16 tests incl. sign-in (`E2E_SERVER_LOG`); all pass                            |
| —           | Rate limiting                | ✅     | SQLite fixed window on analyze, geocode and sign-in                                        |
| —           | Plans (freemium)             | ✅     | `entitlements.ts`; limits apply only with `ENFORCE_PLANS=true`                             |

## Done ahead of its phase

| WBS   | Item                       | Phase | Notes                                                                                             |
| ----- | -------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| 5.3.4 | AL licence check           | 3     | Engine supports AL status and containment-zone tax; hidden in the UI until the AL registry exists |
| 4.4.4 | AL indicators              | 3     | Tables and queries done; synthetic seed data                                                      |
| 6.3.1 | Favourites, saved searches | 2–3   | Tables only                                                                                       |

## Changed by plan v2

- **No automatic estimates in v1.** The planned area-median valuation and the Python
  valuation service are dropped; the user enters market values and INE medians are shown as a
  reference.
- **No Python, Redis, SpatiaLite or Docker.** Import jobs in TypeScript; cache and job queue in
  SQLite; freguesia lookup with R*Tree + Turf.js. SpatiaLite no longer needs to be installed.
- **Link reader moves into the MVP.** Previously deferred to "sources that agree".
- **Vender** only collects sales-support requests until Phase 4.
- **New in Phase 2:** sharing to X and Facebook (public scenario page) and emailing reports.

## Next steps (proposed)

1. Commit the Phase 2 work.
2. Record analytics events (`logEvent`) for searches, scenarios run and leads.
3. Alerts engine (6.3.5).
4. Decisions from the project owner: link-reader allow-list, domain, tax review, cookie banner.
5. Install the services (`docs/deployment.md`) to put the site online.
6. Verify the IMI rates and the 2025/2026 tax parameters (accountant review).
