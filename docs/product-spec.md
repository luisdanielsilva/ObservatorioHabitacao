# OlhoVivo — AI-powered real estate investment platform for Portugal

> Product brief and work breakdown structure as provided by the project owner (version 2,
> received 2026-10-03). This is the project plan; see [status.md](status.md) for progress
> and [architecture.md](architecture.md) for the technical design.

## Part A — Build prompt

---

You are a senior full-stack engineer and product designer. Build **OlhoVivo**, a real estate investment intelligence platform for the Portuguese market. OlhoVivo evaluates properties and calculates investment scenarios, so investors can quickly see what a property is worth, how much it can earn, and which strategy makes the most sense. In the first version, the user provides the market values (market value, rent, nightly rate, occupancy, resale price) and OlhoVivo applies the costs, Portuguese taxes and financing to calculate each scenario. Estimating those values automatically from market data is a later phase. The work breakdown structure in Part B is the project plan; follow its structure and phases.

## 1. Product goals

**Main goal:** evaluate properties and calculate investment scenarios, so the user can see which strategy makes the most sense for each property:

- **Investment (buy & resell / fix & flip):** purchase price, acquisition costs (IMT, Imposto do Selo, notary/registry), renovation, holding costs, financing, expected sale price, capital gains tax, net profit, ROI and IRR.
- **Long-term rental (arrendamento):** expected monthly rent, vacancy, IMI, condominium, insurance, maintenance, rental income tax, gross and net yield, cash flow and payback period.
- **Short-term rental (alojamento local):** nightly rate, occupancy (with seasonality), platform fees, cleaning, management, utilities, AL licence and local restrictions, taxes, net yield and cash flow.
- **Contract position selling (cessão de posição contratual):** price agreed in the CPCV, deposit (sinal) paid, expected market value at assignment, assignment price, costs and taxes, net profit and return on the deposit.

## 2. Languages and tone

- UI in **Portuguese (pt-PT)** by default, with an **English** toggle (i18n from day one; no hard-coded strings).
- Clear, direct, trustworthy tone. Euro formatting (`250 000 €`), metric units, Portuguese address conventions (distrito → concelho → freguesia).
- Every metric (yield, ROI, IRR, cash flow, etc.) has a short help text explaining what it means.

## 3. Main navigation

Header: logo · **Comprar** (search) · **Vender** · **Avaliar anúncio** · **Preços** · language toggle (PT/EN) · **Entrar / Conta**.

Footer: about, contacts, privacy policy (RGPD), terms, cookie settings, app store badges (for later).

## 4. Core features

### 4.1 Property evaluation & scenario calculator (core feature)

Reachable from **Avaliar anúncio** and from the user's dashboard. The main flow starts from a **listing link given by the user**.

- **Property input:** the user pastes a listing link. OlhoVivo reads that page on demand (only from sites whose terms allow it) and pre-fills location, type, typology, area, condition, asking price and extras; the user confirms or corrects them. Manual entry is the fallback.
- **Location:** the property's address or coordinates are matched to its freguesia and concelho using the CAOP boundaries.
- **Market reference (INE):** next to the user's inputs, show the INE median sale €/m² and rent €/m² for that freguesia/concelho, and how the asking price and the user's rent compare (e.g. "14 €/m² vs. median of 12 €/m² in the parish").
- **Market values (entered by the user):** market value, expected resale price, expected monthly rent, expected nightly rate and occupancy (by season), and for the cessão de posição: CPCV price, deposit and expected assignment price. Fields show units and short help texts. Automatic estimates for these fields come in a later phase.
- **Evaluation:** compares the asking price with the market value entered by the user and shows whether it is **below, in line with, or above** it.
- **Scenarios:** OlhoVivo runs all four scenarios from section 1 using the values entered by the user; acquisition costs, taxes and financing are calculated automatically from the tax parameters. Results update instantly when any input changes.
- **Common inputs:** purchase price, acquisition costs (calculated automatically), renovation budget, financing (own capital, loan amount, interest rate, term), holding period.
- **Results per scenario:** total investment, net profit or annual cash flow, gross/net yield, ROI, IRR, payback period, and a chart over time.
- _Later phase (needs the AL registry):_ AL check showing whether new AL registrations are allowed in that area (containment zones).
- **Comparison view:** the four scenarios side by side, with the best one highlighted according to the user's goal (highest profit, best yield, lowest capital needed).
- **Sensitivity analysis:** sliders showing how results change if price, rent, occupancy or interest rate move.
- **Save, duplicate, export and share** scenarios: PDF report, direct sharing to X and Facebook (a summary with a link to a public scenario page), and sending the report by email to any address the user chooses.

### 4.2 Property search (Comprar) — later phase

Requires listing sources (portals/partners), which are not used for now.

- Search by location (district / municipality / parish, with autocomplete), property type (apartamento, moradia, terreno, loja, armazém…), typology (T0–T5+), price range, area, condition (novo, usado, para recuperar), and extras (garagem, elevador, varanda, piscina).
- _Later phase (needs automatic estimates):_ filter and sort by estimated yield (long-term and AL) and by discount vs. market value.
- Results as list + interactive map (MapLibre with clustering).
- Each listing card shows: photo, price, €/m², area, typology and location. _Later phase:_ opportunity signal (oportunidade / preço justo / acima do mercado) and estimated gross yield.
- Listing detail page: gallery, characteristics, price history, comparison against zone median, map, link to original source, and a button to open the scenario calculator with the listing's data pre-filled.
- Saved searches and **alerts** (email / push), including alerts when a property reaches a target yield or discount.

### 4.3 Free home valuation (Vender) — later phase

Requires automatic estimates (section 5). Until then, the Vender page can collect sales-support requests only.

- Multi-step form: address → type & typology → area → condition → extras → contact (optional, configurable).
- Output: estimated sale value range, estimated €/m², estimated monthly rent, confidence level, and the most similar comparables used.
- CTA to request professional sales support (lead capture into the admin).

### 4.4 Market prices (Preços)

- Overview page with all 18 districts plus Açores and Madeira.
- Drill-down pages: district → municipality → parish, each with INE median sale €/m², median rent €/m², gross yield, trend charts and comparison with neighbouring areas.
- SEO-friendly static/ISR pages (e.g. `/precos/lisboa/cascais`).

### 4.5 User accounts

- Sign up with email (magic link) and Google.
- Dashboard: saved properties, saved scenarios, saved searches/alerts, valuations made, requests sent.
- RGPD: consent management, data export and account deletion.

## 5. Scenario engine & data

- **Data sources (current):** all used to support the analysis of the link the user provides:
  - **INE:** median sale and rent €/m² by concelho and freguesia, with history.
  - **Tax & financing:** IMT, Imposto do Selo, IMI, income and capital gains tax rules, Euribor and typical spreads (from official sources: Portal das Finanças, Banco de Portugal).
  - **Open geodata:** CAOP boundaries (DGT) to place the property in its freguesia/concelho; point-in-polygon done in TypeScript (e.g. Turf.js).
  - Imported by scheduled scripts and refreshed when new data is published.
- **Data sources (later):** listing portals/partners (for Comprar and automatic estimates) and the AL registry (containment zones, AL indicators).
- **Later phase: automatic estimates.** Once the scenario engine is in use, fill the market-value fields automatically (the user can still overwrite them):
  - **Valuation model:** start with a transparent comparables approach (same parish/zone, similar type, area, typology, condition → weighted median €/m²), then evolve to a gradient-boosted model (e.g. LightGBM) with explainable features. The model is trained and run in batch by a scheduled script, which stores its estimates in SQLite; the web app only reads them.
  - **Rent estimates:** long-term rent from rental comparables; short-term revenue from nightly rate × occupancy, by season.
- **Scenario engine:** a pure, well-tested calculation module (no UI dependencies) with one function per scenario plus the comparison and sensitivity analysis. All formulas documented in the code and in the help texts. Key definitions:
  - Gross yield = annual rent ÷ total acquisition cost
  - Net yield = (annual rent − operating costs − taxes) ÷ total investment
  - ROI = net profit ÷ own capital invested
  - IRR = from the monthly cash-flow series over the holding period
  - Cessão de posição contratual return = net profit ÷ deposit (sinal) paid
- **Financial & tax parameters:** IMT tables, Imposto do Selo, IMI rates per municipality, income and capital gains tax rules, Euribor and typical spreads. Store them as versioned, editable parameters in the database (never hard-coded), with the year they apply to.
- **Opportunity score:** % difference between asking price and market value (entered by the user now; estimated automatically later, then adjusted for confidence and time on market).

## 6. Admin back-office

- Manage data sources (INE, CAOP, tax parameters) and import jobs.
- Manage financial & tax parameters (with versions per year).
- Leads/CRM: valuation and sales-support requests, with status.
- Basic analytics: users, searches, scenarios run, alerts sent, leads by region.

## 7. Monetisation (design for it, don't overbuild)

Freemium: search, prices, valuation and basic scenarios are free. Premium plan for advanced features (unlimited saved scenarios, PDF reports, sensitivity analysis, yield alerts). Additional revenue from success-based commissions on assisted purchases/sales and partner referrals (credit intermediaries, lawyers, home inspection).

## 8. Design

- Modern, clean, data-driven look; dark theme as default with a light theme option.
- Mobile-first and responsive; fast (good Core Web Vitals).
- Accessible (WCAG 2.1 AA): contrast, keyboard navigation, alt text.
- Clear charts for scenario results, cash flow over time and price trends; strong use of maps.

## 9. Suggested tech stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui, next-intl for i18n.
- **Charts:** Recharts or ECharts.
- **Maps:** MapLibre GL with vector tiles.
- **Backend/API:** Next.js route handlers only, reading and writing SQLite directly. No separate API service. The scenario engine is a TypeScript module inside the app.
- **Database:** SQLite in WAL mode, accessed with a type-safe query layer (e.g. Drizzle ORM). Location searches without extensions: the parish code is stored on each listing at ingestion, nearby comparables use an indexed latitude/longitude bounding box plus a distance formula, and map views use SQLite's built-in R*Tree index. Add SpatiaLite later only if exact boundary checks are needed at scale. SQLite also handles caching (a cache table with expiry) and the background job queue (a jobs table polled by the workers). No Redis.
- **Auth:** Auth.js.
- **Jobs:** scheduled scripts (systemd timers or cron) for ingestion, aggregations, valuation batches and alerts. TypeScript by default; Python only where it is clearly better (data cleaning, ML training).
- **PDF reports:** server-side rendering (e.g. Playwright or React-PDF).
- **Hosting:** the existing Ubuntu VPS (Hetzner) with automatic backups. No Docker: run the Next.js app directly as a systemd service, with the scheduled scripts as systemd timers, behind a reverse proxy (Caddy or Nginx) with HTTPS. Before the daily VPS backup, take a consistent copy of the database with SQLite's `.backup` command.
- **Email:** Resend / Postmark.

## 10. Deliverables and order of work

1. Database schema (locations hierarchy, INE prices and rents, financial/tax parameters, analysed listings, scenarios, users, leads) in SQLite.
2. Scenario engine with unit tests that match a reference spreadsheet of worked examples.
3. Data import: INE prices and rents, tax and financing parameters, CAOP boundaries.
4. Link reader for Avaliar anúncio (on demand, with manual fallback).
5. Pages: home, Avaliar anúncio + scenario calculator and comparison, Preços (all levels), account dashboard, admin.
6. Saved scenarios, PDF reports, sharing (X, Facebook, email) and alerts.
7. SEO (sitemaps, metadata, structured data), RGPD cookie banner, analytics.
8. Later phases: listing sources and search (Comprar), AL registry, automatic estimates (valuation, rent, AL revenue) and the Vender valuation flow.

Always show a disclaimer on valuations and scenarios: results are estimates and not financial or tax advice.

Work iteratively: propose the architecture and schema first, then build feature by feature, with clean, typed, tested code and a README explaining how to run it locally.

---

## Part B — Work Breakdown Structure (WBS)

The WBS splits OlhoVivo into deliverables (level 1), sub-deliverables (level 2) and work packages (level 3). Each work package should be small enough to estimate, assign and track as a single task. The core of the project is **property evaluation and investment scenarios** (buy & resell, long-term rental, short-term rental, contract position selling).

```
OlhoVivo
├── 1. Project management
├── 2. Discovery & design
├── 3. Infrastructure & DevOps
├── 4. Data platform
├── 5. Valuation & scenario engine
├── 6. Backend & API
├── 7. Frontend (web app)
├── 8. Admin back-office
├── 9. Content, SEO & marketing
├── 10. Legal & compliance
├── 11. Quality assurance
└── 12. Launch & operations
```

### 1. Project management

- **1.1 Initiation**
  - 1.1.1 Define vision, goals and success metrics (KPIs)
  - 1.1.2 Define scope and MVP vs. later phases
  - 1.1.3 Budget and resource plan
- **1.2 Planning**
  - 1.2.1 Roadmap and milestones
  - 1.2.2 Backlog setup (issues, epics, sprints)
  - 1.2.3 Risk register
- **1.3 Monitoring & control**
  - 1.3.1 Sprint planning and reviews
  - 1.3.2 Progress and budget tracking
  - 1.3.3 Change management

### 2. Discovery & design

- **2.1 Market research**
  - 2.1.1 Competitor analysis (explorador.pt, Idealista, Imovirtual, Casa Sapo, Supercasa, investment calculators)
  - 2.1.2 User interviews (investors, landlords, AL operators, buyers)
  - 2.1.3 Personas and user journeys (one per scenario)
- **2.2 Brand identity**
  - 2.2.1 Logo and visual identity for OlhoVivo
  - 2.2.2 Colour palette, typography, tone of voice
  - 2.2.3 Domain registration (olhovivo.pt) and INPI trademark check/registration
- **2.3 Scenario methodology**
  - 2.3.1 Define formulas and assumptions for each scenario (with an accountant/tax advisor)
  - 2.3.2 Define default values (vacancy, maintenance, AL occupancy, fees) and which inputs users can edit
  - 2.3.3 Reference spreadsheet with worked examples (used later to test the engine)
- **2.4 UX/UI design**
  - 2.4.1 Information architecture and sitemap
  - 2.4.2 Wireframes (all key pages, including scenario calculator and comparison)
  - 2.4.3 Design system (components, charts, dark/light themes)
  - 2.4.4 High-fidelity mockups (mobile and desktop)
  - 2.4.5 Clickable prototype and usability testing

### 3. Infrastructure & DevOps

- **3.1 Environments**
  - 3.1.1 Development, staging and production
  - 3.1.2 VPS provisioning
- **3.2 Code & CI/CD**
  - 3.2.1 Git repository and branching strategy
  - 3.2.2 CI pipeline (lint, tests, build)
  - 3.2.3 Deployment script (pull, build, restart systemd services)
- **3.3 Services**
  - 3.3.1 SQLite (WAL mode, R*Tree index for locations)
  - 3.3.2 Cache and job-queue tables in SQLite
  - 3.3.3 Object storage for images
  - 3.3.4 Transactional email service
- **3.4 Observability & security**
  - 3.4.1 Logging, monitoring and alerting
  - 3.4.2 VPS automatic backups + nightly SQLite `.backup` copy, and restore tests
  - 3.4.3 SSL, firewall, secrets management

### 4. Data platform

- **4.1 Data model**
  - 4.1.1 Database schema (locations, INE prices and rents, tax parameters, analysed listings, scenarios, users, leads)
  - 4.1.2 Location hierarchy (distrito → concelho → freguesia)
- **4.2 Data sources**
  - 4.2.1 INE: median sale and rent €/m² by concelho and freguesia
  - 4.2.2 Open geodata: CAOP boundaries (DGT)
  - 4.2.3 Tax and financing sources (Portal das Finanças, Banco de Portugal)
  - 4.2.4 Later: listing portals/partners, AL registry and short-term rental data
- **4.3 Ingestion pipeline**
  - 4.3.1 Import scripts per source (INE, CAOP, tax parameters)
  - 4.3.2 Normalisation and data cleaning
  - 4.3.3 Geocoding of addresses and freguesia lookup (CAOP)
  - 4.3.4 Link reader: extract property data from the listing page the user provides
  - 4.3.5 Scheduling and failure handling
- **4.4 Aggregations**
  - 4.4.1 Median sale €/m² per district, municipality, parish
  - 4.4.2 Median rent €/m² per area (long-term)
  - 4.4.3 Historical series and trends
  - 4.4.4 Later: AL indicators and market statistics (stock, time on market)
- **4.5 Financial & tax parameters**
  - 4.5.1 IMT tables, Imposto do Selo, notary/registry costs
  - 4.5.2 IMI rates per municipality
  - 4.5.3 Income tax rules (rental income, AL income, capital gains)
  - 4.5.4 Financing parameters (Euribor, typical spreads, LTV limits)
  - 4.5.5 Yearly update process for all parameters

### 5. Valuation & scenario engine

- **5.1 Property valuation (later phase: automatic estimates)**
  - 5.1.1 Comparables-based sale value (v1)
  - 5.1.2 Machine-learning model (v2, e.g. LightGBM)
  - 5.1.3 Confidence score and explainability
  - 5.1.4 Model evaluation and accuracy tracking
- **5.2 Income estimation (later phase: automatic estimates)**
  - 5.2.1 Long-term rent estimate (comparables)
  - 5.2.2 Short-term rental revenue estimate (ADR × occupancy, by season)
- **5.3 Scenario calculations**
  - 5.3.1 Inputs: purchase price, renovation, financing, holding period, plus market values entered by the user (market value, resale price, rent, nightly rate, occupancy, CPCV price and deposit); acquisition costs calculated automatically
  - 5.3.2 Buy & resell (fix & flip): net profit, ROI, IRR
  - 5.3.3 Long-term rental: gross/net yield, monthly cash flow, payback
  - 5.3.4 Short-term rental (AL): net yield, cash flow, seasonal breakdown (licence check later, with the AL registry)
  - 5.3.5 Contract position selling (cessão de posição contratual): assignment price, net profit, return on deposit
  - 5.3.6 Side-by-side comparison and recommended strategy
  - 5.3.7 Sensitivity analysis (price, rent, occupancy, interest rate)
- **5.4 Opportunity score**
  - 5.4.1 Asking price vs. market value (user-provided now, estimated later)
  - 5.4.2 Classification (oportunidade / preço justo / acima do mercado)
- **5.5 Listing assessment (Avaliar anúncio)**
  - 5.5.1 Read the listing link (uses 4.3.4)
  - 5.5.2 Manual entry fallback
  - 5.5.3 Show the INE market reference for the property's freguesia
  - 5.5.4 Run all scenarios for the assessed listing

### 6. Backend & API

- **6.1 Authentication & users**
  - 6.1.1 Sign-up/login (email magic link, Google)
  - 6.1.2 Profiles, roles and permissions
- **6.2 Core APIs**
  - 6.2.1 Later: search and filters (Comprar)
  - 6.2.2 Link analysis endpoint (read link, locate, INE reference)
  - 6.2.3 Prices and rents endpoints (by area)
  - 6.2.4 Valuation endpoint
  - 6.2.5 Scenario calculation and comparison endpoints
- **6.3 User features**
  - 6.3.1 Favourites and saved searches
  - 6.3.2 Saved scenarios (edit, duplicate, compare)
  - 6.3.3 Scenario report export (PDF)
  - 6.3.4 Sharing: X and Facebook (public scenario link with preview image) and sending the report by email to a chosen address
  - 6.3.5 Alerts engine (email/push), incl. alerts by target yield
- **6.4 Leads**
  - 6.4.1 Valuation, negotiation and sales-support requests
  - 6.4.2 Notifications to the team

### 7. Frontend (web app)

- **7.1 Foundations**
  - 7.1.1 Project setup (Next.js, TypeScript, Tailwind)
  - 7.1.2 i18n (PT/EN)
  - 7.1.3 Layout, header (Comprar · Vender · Avaliar anúncio · Preços), footer, theming
- **7.2 Public pages**
  - 7.2.1 Home page
  - 7.2.2 Later: search results (list + map)
  - 7.2.3 Later: listing detail page
  - 7.2.4 Scenario calculator (inputs, results, charts)
  - 7.2.5 Scenario comparison view
  - 7.2.6 Vender — valuation flow (later phase)
  - 7.2.7 Avaliar anúncio
  - 7.2.8 Preços (overview + district/municipality/parish pages)
  - 7.2.9 About, contacts, legal pages
- **7.3 Private area**
  - 7.3.1 User dashboard
  - 7.3.2 Analysed listings, saved scenarios and alerts
  - 7.3.3 Account settings and RGPD actions
- **7.4 Quality**
  - 7.4.1 Responsiveness and accessibility (WCAG 2.1 AA)
  - 7.4.2 Performance (Core Web Vitals)

### 8. Admin back-office

- 8.1 Data-source management (INE, CAOP, tax parameters)
- 8.2 Import job monitoring
- 8.3 Financial & tax parameters management
- 8.4 Leads/CRM (status, assignment, notes)
- 8.5 User management
- 8.6 Analytics dashboard

### 9. Content, SEO & marketing

- **9.1 Content**
  - 9.1.1 Page copy (PT and EN)
  - 9.1.2 Help texts explaining each scenario and metric (yield, ROI, IRR, cessão de posição)
- **9.2 SEO**
  - 9.2.1 Metadata, sitemaps, structured data
  - 9.2.2 Programmatic SEO for price pages
- **9.3 Marketing**
  - 9.3.1 Launch campaign
  - 9.3.2 Analytics and conversion tracking

### 10. Legal & compliance

- 10.1 Company setup and business model review (commissions, AMI licence if acting as a real estate intermediary)
- 10.2 RGPD: privacy policy, cookie consent, data processing records
- 10.3 Terms and conditions
- 10.4 Data-source licensing and terms-of-use review
- 10.5 Disclaimers: valuations and scenarios are indicative; not financial or tax advice
- 10.6 Legal/tax review of scenario rules (AL legislation, cessão de posição contratual taxation)

### 11. Quality assurance

- 11.1 Test strategy and plan
- 11.2 Unit and integration tests
- 11.3 Scenario engine validation against the reference spreadsheet (2.3.3)
- 11.4 Valuation and rent estimate accuracy validation (later phase)
- 11.5 End-to-end tests (key user journeys)
- 11.6 Security testing
- 11.7 User acceptance testing (beta investors)

### 12. Launch & operations

- **12.1 Launch**
  - 12.1.1 Closed beta
  - 12.1.2 Bug fixing and adjustments
  - 12.1.3 Public launch
- **12.2 Operations**
  - 12.2.1 Support process (contacts, FAQ)
  - 12.2.2 Data quality monitoring
  - 12.2.3 Yearly tax/parameter updates
  - 12.2.4 Continuous improvement backlog
- **12.3 Future phases**
  - 12.3.1 Mobile apps (iOS/Android)
  - 12.3.2 Partner integrations (credit, lawyers, inspections)
  - 12.3.3 Portfolio tracking (multiple properties)

### Suggested phases

| Phase                  | Focus                                                                                                             | Main WBS items                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0. Foundations         | Plan, brand, scenario methodology, design, infrastructure                                                         | 1, 2, 3, 10.1–10.2, 10.6                                                                                   |
| 1. MVP                 | Avaliar anúncio: link analysis, INE reference and the four scenarios with values entered by the user; price pages | 4.1–4.4.3, 4.5, 5.3.1–5.3.6, 5.4, 5.5, 6.1, 6.2.2–6.2.3, 6.2.5, 7.1, 7.2.1, 7.2.4–7.2.5, 7.2.7–7.2.8, 11.3 |
| 2. Engagement          | Accounts, saved scenarios, sharing, PDF reports, alerts, sensitivity analysis, admin                              | 5.3.7, 6.3–6.4, 7.3, 8, 9                                                                                  |
| 3. Listings & search   | Listing portals/partners, AL registry, Comprar                                                                    | 4.2.4, 4.4.4, 6.2.1, 7.2.2–7.2.3                                                                           |
| 4. Automatic estimates | Value, rent and AL revenue estimated from market data; Vender valuation                                           | 5.1, 5.2, 6.2.4, 7.2.6, 11.4                                                                               |
| 5. Launch & scale      | QA, beta, launch, apps                                                                                            | 11, 12                                                                                                     |
