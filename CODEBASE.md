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
│   │           └── providers/  # Bank data provider abstraction
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
| `apps/api/src/routes/bank-links.ts` | Bank linking — GoCardless (redirect), FinTS (credential-based), and manual entry flows |
| `apps/api/src/routes/bank-connections.ts` | List and delete bank connections |
| `apps/api/src/routes/accounts.ts` | Balance refresh endpoints (single & all accounts) + manual balance entry |
| `apps/api/src/routes/balances.ts` | Balance aggregation summary & account include/exclude toggle |
| `apps/api/src/routes/goals.ts` | Goal CRUD, progress calculation, and account linking/unlinking |
| `apps/api/src/services/gocardless.ts` | GoCardless SDK client, token retrieval & balance fetching |
| `apps/api/src/services/balances.ts` | Fetch & store balances via provider abstraction into DB |
| `apps/api/src/services/providers/types.ts` | `BankDataProvider` interface, `AccountData` union type (`CashAccountData` \| `InvestmentAccountData`) |
| `apps/api/src/services/providers/gocardless-provider.ts` | GoCardless implementation of `BankDataProvider` |
| `apps/api/src/services/providers/fints-provider.ts` | FinTS implementation of `BankDataProvider` (cash accounts only, no depot) |
| `apps/api/src/services/providers/registry.ts` | Provider factory — resolves `gocardless`, `fints`, or `manual` provider |
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
| `apps/mobile/src/screens/AddManualAccountScreen.tsx` | Manual account entry — name, type (cash/investment), balance, gain fields |

## Architecture Overview

- **Monorepo** with npm workspaces (`apps/api`, `apps/mobile`)
- **Backend:** Express + Prisma (PostgreSQL) + TypeScript
- **Frontend:** React Native + Expo + React Native Paper
- **Navigation:** React Navigation — bottom tabs (Overview, Goals, Family, Settings) with stack navigators per tab
- **Testing:** Vitest with contract tests against external services
- **Bank data:** Multi-provider abstraction (`BankDataProvider` interface) with three providers: GoCardless (PSD2 redirect flow), FinTS (ING DiBa credential-based, cash accounts only — depot pending HKWPD support), and Manual (user-entered balances, skipped during auto-refresh). Linking is provider-specific; data fetching is unified.
- **Account categories:** Cash (Giro, savings — balance only) and Investment (Depot — balance + gain amount/percentage)
- **Bank linking flows:** GoCardless (app → browser redirect → API callback → return to app), FinTS (API call with server-side credentials → immediate account creation), Manual (app form → API creates connection + initial balance)

## Data Models

- **BankConnection** — a linked bank (userId, provider, institutionId, requisitionId, referenceId, status). Provider is `gocardless`, `fints`, or `manual`. Created only on successful callback/linking (no pending records).
- **BankAccount** — individual account under a connection (externalId, name, ownerName, accountType, includedInTotal flag). Account type is `cash` or `investment`.
- **Balance** — account balance snapshot (amount, currency, balanceType, gainAmount?, gainPercentage?, fetchedAt). Gain fields are populated for investment accounts only.
- **Goal** — a financial savings goal (name, targetAmount, initialAmount, currency, deadline, interval as `weekly`|`monthly`, userId). Progress = initialAmount + sum of linked account balances (calculated at query time).
- **GoalAccount** — join table linking goals to bank accounts (composite PK on goalId + accountId, cascade delete both sides). Many-to-many: a goal can link multiple accounts, an account can belong to multiple goals.
- Relationships: BankConnection 1→N BankAccount, BankAccount 1→N Balance, Goal N↔N BankAccount (via GoalAccount)

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
| POST | `/api/bank-links/fints` | Link ING accounts via FinTS (credential-based, server-side) |
| POST | `/api/bank-links/manual` | Create manual bank connection with accounts |
| POST | `/api/accounts/:accountId/balances` | Record a manual balance snapshot |
| PATCH | `/api/accounts/:accountId/include` | Toggle account include/exclude from total |
| POST | `/api/goals` | Create a goal |
| GET | `/api/goals?userId=XX` | List goals with calculated progress |
| GET | `/api/goals/:goalId` | Goal detail with linked accounts and progress |
| PATCH | `/api/goals/:goalId` | Update goal fields |
| DELETE | `/api/goals/:goalId` | Delete a goal (cascades GoalAccount) |
| POST | `/api/goals/:goalId/accounts` | Link accounts to a goal |
| DELETE | `/api/goals/:goalId/accounts/:accountId` | Unlink an account from a goal |

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
| `node-fints` | FinTS/HBCI client for German banks (ING DiBa) |
