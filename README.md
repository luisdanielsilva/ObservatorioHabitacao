# OlhoVivo

Real estate investment intelligence for the Portuguese market: property valuation and
investment scenarios (buy & resell, long-term rental, short-term rental / AL, and
cessão de posição contratual).

> Results produced by OlhoVivo are estimates and do not constitute financial or tax advice.

## Repository layout

| Path              | What it is                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js web app (App Router, TypeScript, Tailwind)                                                 |
| `packages/engine` | Pure TypeScript scenario engine — no I/O, no UI; see [METHODOLOGY](packages/engine/METHODOLOGY.md) |
| `packages/db`     | SQLite schema (Drizzle), migrations, seed data and queries                                         |
| `docs/`           | Architecture, schema and methodology notes                                                         |

Planned: `packages/i18n`, `services/data` (Python ingestion + valuation). See [docs/architecture.md](docs/architecture.md).

## Requirements

- Node.js 22 (see `.nvmrc`) and npm 10+

## Running locally

```bash
npm install          # installs all workspaces
npm run db:reset     # creates data/olhovivo.db with the schema and seed data
npm run dev          # web app on http://localhost:3000
```

The database lives in `data/olhovivo.db` (git-ignored); set `DATABASE_PATH` to use another
file. Other database commands:

```bash
npm run db:migrate                    # apply pending migrations
npm run db:generate -w @olhovivo/db   # create a migration after changing src/schema
npm run db:studio -w @olhovivo/db     # browse the data (Drizzle Studio)
```

**Seed data is synthetic.** Districts, regions and municipality codes are real; market
prices, rents, AL indicators, AL rules and IMI rates are placeholders, stored with
`synthetic = 1` or `verified = 0`. The 2025 tax parameters have not been verified by a tax
advisor yet.

## Checks

```bash
npm test             # unit tests (all workspaces)
npm run typecheck
npm run lint
npm run format       # or format:check
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and pull request.
