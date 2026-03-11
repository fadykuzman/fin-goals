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
│       ├── assets/   # App icons & splash images
│       └── src/
│           └── screens/    # Screen components
├── docs/
│   └── adr/          # Architecture Decision Records
└── .claude/
    └── commands/     # Custom Claude Code slash commands
```

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Monorepo root — npm workspaces for `apps/*`, React version overrides |
| `tsconfig.base.json` | Shared TypeScript config (ES2020, strict, ESM) |
| `initial-idea.md` | Project vision & feature scope |
| `DEVELOPMENT.md` | Setup & dev instructions |
| `apps/api/src/index.ts` | Express server entry point — registers all route handlers |
| `apps/api/src/routes/banks.ts` | `GET /api/banks?country=XX` — list supported bank institutions |
| `apps/api/src/routes/bank-links.ts` | Bank linking flow — initiate and callback (returns HTML on success/error) |
| `apps/api/src/routes/bank-connections.ts` | List and delete bank connections |
| `apps/api/src/routes/accounts.ts` | Balance refresh endpoints (single account & all user accounts) |
| `apps/api/src/routes/balances.ts` | Balance aggregation summary & account include/exclude toggle |
| `apps/api/src/services/gocardless.ts` | GoCardless SDK client, token retrieval & balance fetching |
| `apps/api/src/services/balances.ts` | Fetch & store balances from GoCardless into DB |
| `apps/api/prisma/schema.prisma` | Database schema (PostgreSQL) |
| `apps/api/MANUAL_TESTING.md` | Curl commands for manual API testing |
| `apps/api/vitest.config.ts` | Test config (loads dotenv) |
| `docker-compose.yml` | PostgreSQL + pgAdmin for local development |
| `apps/mobile/App.tsx` | Mobile app entry point — bottom tab navigator with settings stack |
| `apps/mobile/src/screens/OverviewScreen.tsx` | Dashboard — total balance, account breakdown cards, pull-to-refresh with bank sync |
| `apps/mobile/src/screens/GoalsScreen.tsx` | Goals tab (placeholder) |
| `apps/mobile/src/screens/FamilyScreen.tsx` | Family tab (placeholder) |
| `apps/mobile/src/screens/SettingsScreen.tsx` | Settings — bank connection list, delete with confirmation, pull-to-refresh |
| `apps/mobile/src/screens/LinkBankScreen.tsx` | Bank linking — searchable country & bank picker, opens auth in system browser |

## Architecture Overview

- **Monorepo** with npm workspaces (`apps/api`, `apps/mobile`)
- **Backend:** Express + Prisma (PostgreSQL) + TypeScript
- **Frontend:** React Native + Expo + React Native Paper
- **Navigation:** React Navigation — bottom tabs (Overview, Goals, Family, Settings) with stack navigators per tab
- **Testing:** Vitest with contract tests against external services
- **Bank data:** GoCardless (nordigen-node SDK) for EU bank connectivity
- **Bank linking flow:** App initiates session → opens bank auth in system browser → bank redirects to API callback → user manually returns to app → pull-to-refresh

## Data Models

- **BankConnection** — a linked bank (userId, institutionId, requisitionId, referenceId, status). Created only on successful callback (no pending records).
- **BankAccount** — individual account under a connection (externalId, name, ownerName, includedInTotal flag)
- **Balance** — account balance snapshot (amount, currency, balanceType, fetchedAt)
- Relationships: BankConnection 1→N BankAccount, BankAccount 1→N Balance

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/banks?country=XX` | List supported bank institutions for a country |
| POST | `/api/bank-links` | Initiate bank linking (returns GoCardless redirect link) |
| GET | `/api/bank-links/callback` | Callback after bank authorization — creates connection & accounts, returns HTML page |
| GET | `/api/bank-connections?userId=XX` | List bank connections with accounts for a user |
| DELETE | `/api/bank-connections/:connectionId` | Cascade delete connection, accounts, and balances |
| POST | `/api/accounts/:accountId/balances/refresh` | Refresh balances for a single account |
| POST | `/api/accounts/balances/refresh` | Refresh balances for all accounts of a user |
| GET | `/api/balances/summary?userId=XX` | Aggregated balance total + per-account breakdown |
| PATCH | `/api/accounts/:accountId/include` | Toggle account include/exclude from total |

## Conventions

- TypeScript everywhere, strict mode
- Routes in `src/routes/`, services in `src/services/`, tests in `__tests__/` colocated
- Screens in `apps/mobile/src/screens/`
- Env vars for secrets (loaded via dotenv)
- ADRs in `docs/adr/` numbered sequentially
- API base URL hardcoded per screen (placeholder until config is centralized)
- User ID hardcoded as placeholder until auth is implemented

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
| `@react-navigation/native` | Navigation framework |
| `@react-navigation/bottom-tabs` | Bottom tab navigator |
| `@react-navigation/native-stack` | Stack navigator |
