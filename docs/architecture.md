# OlhoVivo — Architecture

Status: v2 (2026-10-03), aligned with [product-spec.md](product-spec.md) version 2.
Progress per WBS item is tracked in [status.md](status.md).

## Overview

```
olhovivo/                      npm workspaces monorepo, TypeScript throughout
├── apps/web/                  Next.js 16 (App Router) + Tailwind + shadcn/ui + next-intl
│   ├── src/app/[locale]/...   pt (default, no prefix) / en; /precos/[...path] (ISR)
│   └── src/app/api/...        route handlers: link analysis, prices, scenarios, leads
├── packages/engine/           pure scenario engine, no I/O; runs in browser and server
├── packages/db/               SQLite schema (Drizzle), migrations, queries
├── scripts/ (planned)         import jobs (INE, CAOP, tax parameters), run by systemd timers
└── docs/
```

There is no separate API service, no Python service, no Redis and no Docker. Python is only
added later if ML training (automatic estimates, Phase 4) needs it.

## Key decisions

1. **The user enters the market values in v1.** Market value, resale price, rent, nightly
   rate and occupancy come from the user; OlhoVivo adds costs, taxes and financing. INE
   medians are shown next to the inputs as a reference, not used as estimates. Automatic
   estimates are Phase 4.
2. **Scenario engine in TypeScript, run in the browser.** Results update instantly as inputs
   change. The same module runs on the server for saved scenarios, PDFs and sharing.
3. **Parameters are injected, never hard-coded.** Every engine call receives a
   `ParameterSet` loaded from versioned database rows and validated with Zod. Saved
   scenarios record the parameter-set version they used.
4. **SQLite without extensions.** WAL mode, Drizzle ORM, better-sqlite3.
   - Freguesia lookup: CAOP boundaries stored as simplified GeoJSON per parish, with their
     bounding boxes in a built-in R*Tree index. Candidates are found with the R*Tree and the
     exact point-in-polygon test runs in TypeScript (Turf.js).
   - Caching: a `cache` table with expiry. Background work: a `jobs` table polled by workers.
   - SpatiaLite only if exact boundary checks are needed at scale.
5. **Link reader on demand.** When the user pastes a listing URL, the server fetches that one
   page and extracts the property data, only for domains on an allow-list of sites whose terms
   permit it (WBS 10.4). Otherwise the user fills in the form manually.
6. **Hosting on the existing VPS.** Next.js as a systemd service behind the existing Nginx
   (or Caddy) with HTTPS; import scripts as systemd timers; nightly `sqlite3 .backup` before
   the VPS backup.
7. **Auth.js v5** (`next-auth@5` beta, Drizzle adapter, database sessions) for email magic
   link and Google. Pages stay statically rendered: the header asks for the session in the
   browser. Admins come from `ADMIN_EMAILS`. Transactional email goes through Resend's HTTP API
   (`RESEND_API_KEY`); without a key, emails are written to the server log (development).
8. **Freemium by entitlements.** `src/lib/entitlements.ts` lists what each plan includes
   (saved-scenario limit, PDF, sensitivity, alerts). Limits only apply with `ENFORCE_PLANS=true`;
   during the beta everything is open.

## Data flow for Avaliar anúncio

```
listing URL ──► link reader (allow-listed domains) ──► extracted fields ─┐
manual form ────────────────────────────────────────────────────────────┤
                                                                         ▼
                                       user confirms / corrects property data
                                                                         │
            address/coordinates ──► CAOP lookup (R*Tree + Turf) ──► freguesia, concelho
                                                                         │
                                  INE medians for that area ──► market reference panel
                                                                         │
       user enters market values ──► engine (browser) + active ParameterSet ──► 4 scenarios,
                                                                         comparison, chart
```

## Schema

Implemented (migration `0000_init`) unless marked planned or parked.

**Locations** — `areas`: level (district / municipality / parish), parent, CAOP code, slug,
URL path (e.g. `lisboa/cascais`), centroid. Açores and Madeira sit at district level.
_Planned:_ `area_boundaries` (simplified GeoJSON per parish) and an R*Tree virtual table with
each boundary's bounding box.

**INE market data** — `market_stats`: area, period, metric (median sale €/m², median rent
€/m², …), value, source, synthetic flag. The seed rows are synthetic and will be replaced by
the INE import.

**Parameters** — `parameter_sets`: one complete engine `ParameterSet` (JSON) per year,
region and version; draft / active / archived, one active per year and region, plus who
verified it. `imi_rates`: municipal IMI rate per year. _Planned:_ Euribor and typical spreads
in the parameter set (used as financing defaults in the calculator).

**Analysed listings** — _planned:_ `analyses`: listing URL (optional), source domain,
extracted data, property data as confirmed by the user, area, coordinates, user (optional).
Scenarios point to the analysis they came from.

**Scenarios** — `scenarios`: user, property snapshot, inputs, parameter-set id, results
cache, duplicated-from. _Planned (Phase 2):_ public share token for X/Facebook links.

**Users** — `users` (role, plan, locale, Auth.js fields), `accounts`, `sessions`,
`verification_tokens` (Auth.js), `consents` (RGPD log, one row per change).

**Leads and operations** — `leads` (type, status, assignee, notes; used by Vender sales
support), `ingestion_jobs` (import runs), `events` (analytics). _Planned:_ `cache`, `jobs`.

**Parked for later phases** (in the schema already; unused in v1):

- Listings and search, Phase 3: `sources`, `listings`, `listing_sources`, `price_history`,
  `listing_photos`, `favourites`, `saved_searches`, `alerts_sent`.
- AL registry, Phase 3: `al_rules`, `al_indicators`. Until then the AL check shows
  "unknown" and is hidden in the UI.
- Automatic estimates, Phase 4: `valuations`, `valuation_comparables`.

## Open points

- **Reference spreadsheet (WBS 2.3.3)** and tax review (10.6): the engine's worked examples
  must be checked by an accountant / tax advisor.
- **2026 tax figures** must be added and verified; only 2025 mainland values exist.
- **Link reader allow-list (10.4):** Idealista and Imovirtual forbid automated access in their
  terms, including single-page fetches. Which sites are allowed needs a decision, ideally with
  written permission.
- **INE data access:** confirm which INE indicators (sale and rent medians per concelho /
  freguesia) are available through the INE API and how often they are updated.
- **Server resources** (3.7 GB RAM, 2 vCPU): fine for development; for production, build
  before restarting the service and consider swap.
