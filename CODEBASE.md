# Codebase Map

## Project Structure

```
fin-goals/
├── apps/
│   ├── api/          # Node.js + Express backend
│   │   ├── prisma/   # Prisma ORM schema & migrations
│   │   └── src/
│   │       ├── routes/     # Express route handlers
│   │       └── services/   # External service integrations
│   └── mobile/       # React Native + Expo frontend
│       └── assets/   # App icons & splash images
├── docs/
│   └── adr/          # Architecture Decision Records
└── .claude/
    └── commands/     # Custom Claude Code slash commands
```

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Monorepo root — npm workspaces for `apps/*` |
| `tsconfig.base.json` | Shared TypeScript config (ES2020, strict, ESM) |
| `initial-idea.md` | Project vision & feature scope |
| `DEVELOPMENT.md` | Setup & dev instructions |
| `apps/api/src/index.ts` | Express server entry point (`/health` endpoint, port 3000) |
| `apps/api/src/routes/banks.ts` | `GET /api/banks?country=XX` — list supported bank institutions |
| `apps/api/src/routes/bank-links.ts` | Bank linking flow — initiate and callback endpoints |
| `apps/api/src/services/gocardless.ts` | GoCardless SDK client & token retrieval |
| `apps/api/prisma/schema.prisma` | Database schema (PostgreSQL) |
| `docker-compose.yml` | PostgreSQL + pgAdmin for local development |
| `apps/api/vitest.config.ts` | Test config (loads dotenv) |
| `apps/mobile/App.tsx` | Mobile app entry point (placeholder) |

## Architecture Overview

- **Monorepo** with npm workspaces (`apps/api`, `apps/mobile`)
- **Backend:** Express + Prisma (PostgreSQL) + TypeScript
- **Frontend:** React Native + Expo + React Native Paper
- **Testing:** Vitest with contract tests against external services
- **Bank data:** GoCardless (nordigen-node SDK) for EU bank connectivity

## Data Models

- **BankConnection** — a linked bank (userId, institutionId, requisitionId, referenceId, status)
- **BankAccount** — individual account under a connection (externalId → GoCardless account ID)
- Relationship: BankConnection 1→N BankAccount

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/banks?country=XX` | List supported bank institutions for a country |
| POST | `/api/bank-links` | Initiate bank linking (returns GoCardless redirect link) |
| GET | `/api/bank-links/callback?ref=XX` | Callback after bank authorization (stores accounts) |

## Conventions

- TypeScript everywhere, strict mode
- Routes in `src/routes/`, services in `src/services/`, tests in `__tests__/` colocated
- Env vars for secrets (loaded via dotenv)
- ADRs in `docs/adr/` numbered sequentially

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `@prisma/client` | Database ORM |
| `nordigen-node` | GoCardless Bank Account Data SDK |
| `dotenv` | Env var loading |
| `vitest` | Test framework |
| `expo` | Mobile app framework |
| `react-native-paper` | Material Design UI components |
