# OlhoVivo

Real estate investment intelligence for the Portuguese market: property valuation and
investment scenarios (buy & resell, long-term rental, short-term rental / AL, and
cessão de posição contratual).

> Results produced by OlhoVivo are estimates and do not constitute financial or tax advice.

## Repository layout

| Path              | What it is                                                         |
| ----------------- | ------------------------------------------------------------------ |
| `apps/web`        | Next.js web app (App Router, TypeScript, Tailwind)                 |
| `packages/engine` | Pure TypeScript scenario engine — no I/O, no UI; fully unit tested |
| `docs/`           | Architecture, schema and methodology notes                         |

Planned: `packages/db` (schema + migrations), `packages/i18n`, `services/data` (Python
ingestion + valuation). See [docs/architecture.md](docs/architecture.md).

## Requirements

- Node.js 22 (see `.nvmrc`) and npm 10+

## Running locally

```bash
npm install          # installs all workspaces
npm run dev          # web app on http://localhost:3000
```

## Checks

```bash
npm test             # unit tests (all workspaces)
npm run typecheck
npm run lint
npm run format       # or format:check
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and pull request.
