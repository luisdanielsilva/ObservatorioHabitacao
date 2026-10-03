# OlhoVivo — Status

Updated 2026-10-03, against [product-spec.md](product-spec.md) version 2.

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
| 3.3.2     | Cache and job tables               | ⬜     |                                                                      |
| 3.4       | Logging, backups, SSL              | ⬜     | Nightly `.backup` + Nginx/SSL with the deployment                    |
| 10.1–10.2 | Company setup, RGPD                | ⬜ 👤  |                                                                      |
| 10.6      | Tax/legal review of scenario rules | ⬜ 👤  | Open questions listed in METHODOLOGY.md                              |

## Phase 1 — MVP

| WBS         | Item                                   | Status | Notes                                                                           |
| ----------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| 4.1         | Database schema, location hierarchy    | 🟡     | 22 tables done; to add: `analyses`, `area_boundaries` + R*Tree, `cache`, `jobs` |
| 4.2.1       | INE sale and rent medians              | ⬜     | Seed has synthetic placeholders for 4 municipalities                            |
| 4.2.2       | CAOP boundaries                        | ⬜     | Seed has all 20 districts/regions, 4 municipalities, 22 parishes                |
| 4.2.3       | Tax and financing sources              | 🟡 👤  | 2025 mainland parameters seeded, unverified; Euribor/spreads missing; no 2026   |
| 4.3.1–4.3.2 | Import scripts, cleaning               | ⬜     |                                                                                 |
| 4.3.3       | Address geocoding, freguesia lookup    | ⬜     | Geocoder to choose (needs an allowed, ideally free service)                     |
| 4.3.4       | Link reader                            | ⬜ 👤  | Needs the allow-list of permitted sites                                         |
| 4.3.5       | Scheduling and failure handling        | 🟡     | `ingestion_jobs` table exists; no runner                                        |
| 4.4.1–4.4.3 | Median prices/rents, history           | 🟡     | Tables and queries done; real data comes with the INE import                    |
| 4.5.1       | IMT, Imposto do Selo, notary/registry  | ✅     | In the parameter set, versioned; values unverified                              |
| 4.5.2       | IMI per municipality                   | 🟡     | Table and query done; 4 placeholder rates                                       |
| 4.5.3       | Rental, AL and capital gains tax rules | ✅     | In the parameter set; values unverified                                         |
| 4.5.4       | Euribor, spreads, LTV limits           | 🟡     | LTV and early repayment fee done; Euribor and spreads to add                    |
| 4.5.5       | Yearly update process                  | 🟡     | Draft → active versioning done; no admin screen yet                             |
| 5.3.1–5.3.5 | Four scenarios                         | ✅     | Engine takes user-entered market values, as v2 requires                         |
| 5.3.6       | Comparison and recommended strategy    | ✅     | Goals: profit, IRR, yield, lowest capital                                       |
| 5.4         | Opportunity score                      | ⬜     | Small: asking price vs. user's market value                                     |
| 5.5         | Listing assessment flow                | ⬜     |                                                                                 |
| 6.1         | Auth (Auth.js)                         | ⬜     | Phase 1 in the table, Phase 2 in the text; to confirm                           |
| 6.2.2       | Link analysis endpoint                 | ⬜     |                                                                                 |
| 6.2.3       | Prices and rents endpoints             | 🟡     | Queries done; no endpoints                                                      |
| 6.2.5       | Scenario endpoints                     | 🟡     | Engine done; server endpoints come with saving (Phase 2)                        |
| 7.1.1       | Next.js, TypeScript, Tailwind          | ✅     | Plus shadcn/ui, next-intl, next-themes, Recharts installed (not committed)      |
| 7.1.2       | i18n PT/EN                             | ⬜     |                                                                                 |
| 7.1.3       | Layout, header, footer, theming        | ⬜     |                                                                                 |
| 7.2.1       | Home page                              | ⬜     | Placeholder only                                                                |
| 7.2.4–7.2.5 | Calculator and comparison view         | ⬜     | Next up                                                                         |
| 7.2.7       | Avaliar anúncio                        | ⬜     |                                                                                 |
| 7.2.8       | Preços pages                           | ⬜     |                                                                                 |
| 11.3        | Engine vs. reference spreadsheet       | 🟡 👤  | 59 tests pass (45 engine, 14 database); spreadsheet pending                     |

## Done ahead of its phase

| WBS   | Item                       | Phase | Notes                                                                                             |
| ----- | -------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| 5.3.7 | Sensitivity analysis       | 2     | Engine functions done; sliders in the UI come in Phase 2                                          |
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

1. Commit the frontend setup; add the schema changes (`analyses`, boundaries + R*Tree,
   `cache`, `jobs`, Euribor/spreads in the parameter set).
2. Web foundations: i18n, layout, theme.
3. Calculator with user-entered values and the comparison view, using seed data.
4. Preços pages.
5. INE and CAOP imports (replace synthetic data).
6. Link reader, once the allow-list is decided.
