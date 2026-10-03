# OlhoVivo — Architecture

Status: draft v1 (2026-10-02). Covers WBS 3.2.1, 4.1 and the Phase 0–1 technical plan.

## Overview

```
olhovivo/                      npm workspaces monorepo
├── apps/web/                  Next.js (App Router) + TS + Tailwind + shadcn/ui + next-intl
│   ├── app/[locale]/...       pt (default) / en; /precos/[distrito]/[concelho]/[freguesia] (ISR)
│   └── app/api/...            route handlers: valuation, scenarios, search, leads
├── packages/engine/           pure TypeScript scenario engine, no I/O; Vitest
├── packages/db/               Drizzle ORM schema + migrations (better-sqlite3 + mod_spatialite)
├── packages/i18n/             message catalogues incl. metric help texts
└── services/data/             FastAPI (Python): ingestion, geocoding, dedupe, aggregations, ML
```

## Key decisions

1. **Scenario engine in TypeScript.** It runs in the browser, so results update instantly
   while the user edits inputs. The same code runs on the server for PDF reports, alerts
   and the API, so there is one source of truth. Python is used only for data and ML.
2. **Parameters are injected, never hard-coded.** Every engine call receives a
   `ParameterSet` (IMT brackets, Imposto do Selo, notary/registry, IRS rules, Euribor,
   spreads, LTV) loaded from versioned DB rows and validated with Zod. Each saved scenario
   records the parameter-set version it was calculated with.
3. **SpatiaLite where it adds value.** CAOP boundary polygons, PDM zoning and AL containment
   zones are geometries (point-in-polygon lookups). Listings store lat/lng plus an R*Tree
   index for fast map bounding-box queries.
4. **Valuation v1 (comparables, weighted median €/m²) runs in Python.** Results are written to
   SQLite, so the web app reads them directly.
5. **No Docker during development.** Everything runs natively with Node and Python. The
   deployment method (Docker Compose vs. systemd + nginx) is decided at WBS 3.2.3.

## Schema (first draft)

**Locations** — a single `areas` table with level (district / municipality / parish), parent,
CAOP code, slug, URL path (e.g. `lisboa/cascais`) and centroid. Açores and Madeira sit at the
district level. Boundary geometry is added with SpatiaLite (not installed yet).

**Listings** — `sources`, `listings` (canonical property), `listing_observations`
(per source, per crawl: price, status), `listing_photos`, `price_history`.

**Market data**

- `market_stats`: area level + id, period, metric (sale €/m², rent €/m², stock, time on
  market), value, source.
- `al_indicators`: ADR and occupancy per area and month.
- `al_zones`: containment-zone polygons and status.
- `pdm_zones`: zoning class polygons per municipality.

**Parameters** — `parameter_sets`: one complete engine `ParameterSet` (JSON, validated with
Zod) per year, region and version, with status draft / active / archived (one active per year
and region) and who verified it. Municipal IMI rates live in `imi_rates`, per year.

**Valuations** — `valuations` (input, low/likely/high, €/m², confidence, model version) and
`valuation_comparables`.

**Users and saved items**

- `users` with role, plan and locale. Session, account and token tables come with the auth
  library (WBS 6.1).
- `consents` (RGPD log).
- `favourites`, `saved_searches` (filters JSON plus alert rules such as target yield or
  discount), `alerts_sent`.

**Scenarios** — `scenarios`: user, property snapshot, inputs JSON, parameter-set id, results
cache. Duplicating creates a new row pointing to its origin.

**Leads and admin** — `leads` (type, status, assignee, notes), `ingestion_jobs` (source,
status, counts, errors), `events` (analytics).

## Phase 0–1 order of work

1. Scaffold: monorepo, git, CI (format, lint, typecheck, test, build), README. ✅
2. Engine: four scenarios, IRR, comparison, sensitivity, with unit tests. ✅
3. DB: schema, migrations, seed data for 4 municipalities (Lisboa, Cascais, Porto, Braga)
   with 2025 parameters. ✅
4. Web foundations: i18n, layout, dark/light theme; calculator and comparison view; Preços.
5. Python service: comparables valuation and the Vender flow.

## Open points

- **Reference spreadsheet (WBS 2.3.3).** Engine fixtures must be checked by an accountant /
  tax advisor before they count as validation.
- **2026 tax figures** (IMT, Imposto do Selo, IRS incl. cessão de posição contratual) must
  be verified against the published tables (WBS 10.6).
- **Avaliar anúncio by URL.** Major portals forbid scraping in their terms. MVP: manual
  entry and pasted listing text; URL extraction only for sources that agree to it.
- **Seed data** is realistic but synthetic until INE and partner data are ingested, and is
  labelled as such in the UI.
- **Server resources** (3.7 GB RAM, 2 vCPU): fine for development; for production, build in
  CI or add swap.
