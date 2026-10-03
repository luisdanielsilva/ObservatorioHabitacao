# OlhoVivo

Real estate investment intelligence for the Portuguese market: compare a property's price with
INE market data and calculate four investment scenarios (buy & resell, long-term rental,
short-term rental / AL, and cessão de posição contratual) with Portuguese taxes and financing.

> Results produced by OlhoVivo are estimates and do not constitute financial or tax advice.

Plan: [docs/product-spec.md](docs/product-spec.md) · Progress: [docs/status.md](docs/status.md)
· Design: [docs/architecture.md](docs/architecture.md) · Hosting:
[docs/deployment.md](docs/deployment.md)

## Repository layout

| Path              | What it is                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 web app (App Router, Tailwind, shadcn/ui, next-intl PT/EN)                         |
| `packages/engine` | Pure TypeScript scenario engine, no I/O; see [METHODOLOGY](packages/engine/METHODOLOGY.md)    |
| `packages/db`     | SQLite schema (Drizzle), migrations, queries, seed data and data imports (INE, CAOP, Euribor) |
| `deploy/`         | systemd units, Nginx site and deploy script                                                   |
| `docs/`           | Product spec, status, architecture, deployment                                                |

## Requirements

- Node.js 22 (see `.nvmrc`) and npm 10+

## Running locally

```bash
npm install          # installs all workspaces
npm run db:reset     # creates data/olhovivo.db with the schema and demo seed data
npm run import:all   # optional: real CAOP areas and boundaries, INE prices/rents, Euribor
npm run dev          # web app on http://localhost:3000
```

`import:all` downloads about 370 MB (CAOP) into `data/raw/` and takes a few minutes. Without
it, the app works with demo data for four municipalities, labelled as such.

### Environment variables

| Variable                      | Default                         | Purpose                                                    |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `DATABASE_PATH`               | `data/olhovivo.db`              | SQLite database file                                       |
| `NEXT_PUBLIC_SITE_URL`        | `https://olhovivo.pt`           | Canonical URLs and sitemap                                 |
| `LINK_READER_ALLOWED_DOMAINS` | _(empty: link reader disabled)_ | Comma-separated domains whose terms allow reading listings |
| `BACKUP_DIR` / `BACKUP_KEEP`  | `data/backups` / `14`           | Nightly backup location and number of copies kept          |

### Database commands

```bash
npm run db:migrate                    # apply pending migrations
npm run db:backup -w @olhovivo/db     # consistent copy into data/backups/
npm run db:generate -w @olhovivo/db   # create a migration after changing src/schema
npm run db:studio -w @olhovivo/db     # browse the data (Drizzle Studio)
npm run import:caop | import:ine | import:euribor
```

**Data status.** After `import:all`, areas, boundaries, prices, rents and Euribor are real
(CAOP 2025, INE, ECB). District figures are derived (median of municipal medians). AL
indicators, AL rules and IMI rates are still placeholders (`synthetic = 1` / `verified = 0`),
and the 2025 tax parameters have not yet been verified by a tax advisor.

## Checks

```bash
npm test             # unit tests (engine, db, web)
npm run typecheck
npm run lint
npm run format       # or format:check
npm run build        # needs data/olhovivo.db (run db:reset first)
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and pull request.
