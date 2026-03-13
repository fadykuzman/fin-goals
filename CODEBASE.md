# Codebase Map

## Project Structure

```
fin-goals/
├── apps/
│   ├── api/          # Node.js + Express backend
│   │   ├── prisma/   # Prisma ORM schema & migrations
│   │   └── src/
│   │       ├── middleware/  # Express middleware (auth, etc.)
│   │       ├── routes/     # Express route handlers
│   │       ├── scripts/    # One-off maintenance scripts
│   │       └── services/   # External service integrations
│   │           └── providers/  # Bank data provider abstraction
│   └── mobile/       # React Native + Expo frontend
│       ├── assets/   # App icons & splash images
│       └── src/
│           ├── config/     # Firebase SDK init, shared API client
│           ├── contexts/   # React contexts (auth state)
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
| `apps/api/src/index.ts` | Express server entry point — registers all route handlers, applies auth middleware to `/api/*` (except bank-links callback) |
| `apps/api/src/firebase.ts` | Firebase Admin SDK initialization (service account via `GOOGLE_APPLICATION_CREDENTIALS` env var) |
| `apps/api/src/middleware/auth.ts` | `requireAuth` middleware — verifies Firebase ID token, checks `emailVerified`, sets `req.uid` |
| `apps/api/src/routes/banks.ts` | `GET /api/banks?country=XX` — list supported bank institutions |
| `apps/api/src/routes/bank-links.ts` | Bank linking — GoCardless (redirect), FinTS (credential-based), and manual entry flows |
| `apps/api/src/routes/bank-connections.ts` | List and delete bank connections |
| `apps/api/src/routes/accounts.ts` | Balance refresh endpoints (single & all accounts) + manual balance entry |
| `apps/api/src/routes/balances.ts` | Balance aggregation summary & account include/exclude toggle |
| `apps/api/src/routes/goals.ts` | Goal CRUD, progress calculation (balance-based & transaction-based), account linking/unlinking |
| `apps/api/src/routes/users.ts` | `POST /api/register` — user registration, links Firebase UID to local User record |
| `apps/api/src/routes/transactions.ts` | Transaction refresh endpoint, updates lastSyncedAt on account |
| `apps/api/src/services/gocardless.ts` | GoCardless SDK client, token retrieval & balance fetching |
| `apps/api/src/services/balances.ts` | Fetch & store balances via provider abstraction into DB |
| `apps/api/src/services/transactions.ts` | Fetch & store transactions via provider abstraction, dedup by externalId, SEPA field extraction |
| `apps/api/src/services/cleanup-unverified-users.ts` | Cron job: deletes unverified Firebase users older than `CLEANUP_UNVERIFIED_DAYS` (default 3) from Firebase Auth and local DB |
| `apps/api/src/scripts/backfill-sepa-fields.ts` | One-time backfill of SEPA fields on existing transactions |
| `apps/api/src/services/users.ts` | `getUserByFirebaseUid` helper — resolves Firebase UID to local User record |
| `apps/api/src/services/goals.ts` | Goal progress calculation — discriminated union: balance-based (sum of balances) vs transaction-based (sum of matched outgoing transactions) |
| `apps/api/src/services/providers/types.ts` | `BankDataProvider` interface, `AccountData` union type, `TransactionData` type |
| `apps/api/src/services/providers/gocardless-provider.ts` | GoCardless implementation of `BankDataProvider` |
| `apps/api/src/services/providers/fints-provider.ts` | FinTS implementation of `BankDataProvider` (cash accounts only, no depot) |
| `apps/api/src/services/providers/registry.ts` | Provider factory — resolves `gocardless`, `fints`, or `manual` provider |
| `apps/api/prisma/schema.prisma` | Database schema (PostgreSQL) |
| `apps/api/MANUAL_TESTING.md` | Curl commands for manual API testing |
| `apps/api/vitest.config.ts` | Test config (loads dotenv) |
| `docs/auth-flow.md` | Auth architecture — registration, login, token verification, OAuth callback state pattern, frontend auth navigation |
| `docs/adr/005-asyncstorage-over-securestore-for-firebase-persistence.md` | Why AsyncStorage over SecureStore for Firebase Auth persistence |
| `docker-compose.yml` | PostgreSQL + pgAdmin for local development |
| `apps/mobile/App.tsx` | Mobile app entry point — AuthProvider wrapper, conditional auth stack vs main tab navigator |
| `apps/mobile/src/config/firebase.ts` | Firebase web SDK initialization with AsyncStorage persistence (ADR-005) |
| `apps/mobile/src/config/api.ts` | Shared `apiFetch()` — auto-attaches Firebase ID token as Bearer header to all API requests |
| `apps/mobile/src/contexts/AuthContext.tsx` | AuthContext/AuthProvider — login (with backend registration on first login), register, logout, resetPassword, onAuthStateChanged listener |
| `apps/mobile/src/screens/LoginScreen.tsx` | Login screen — email/password, rejects unverified emails, forgot password & register links |
| `apps/mobile/src/screens/RegisterScreen.tsx` | Registration screen — display name, email, password with confirmation, sends verification email |
| `apps/mobile/src/screens/CheckEmailScreen.tsx` | Post-registration screen — email verification prompt with back-to-login |
| `apps/mobile/src/screens/ForgotPasswordScreen.tsx` | Password reset — email input, sends Firebase reset link |
| `apps/mobile/src/screens/OverviewScreen.tsx` | Dashboard — total balance, account breakdown cards, pull-to-refresh with bank sync |
| `apps/mobile/src/screens/GoalsScreen.tsx` | Goals tab — goal list with progress bars, pull-to-refresh, FAB for create, card tap for detail |
| `apps/mobile/src/screens/GoalDetailScreen.tsx` | Goal detail — progress visualization, required savings, linked accounts, collapsible matched transactions grouped by account, edit/delete actions |
| `apps/mobile/src/screens/CreateEditGoalScreen.tsx` | Create/edit goal form — name, goal type picker, chip input for match patterns, amounts, deadline (date picker), interval, account linking |
| `apps/mobile/src/screens/FamilyScreen.tsx` | Family tab (placeholder) |
| `apps/mobile/src/screens/SettingsScreen.tsx` | Bank Accounts — bank connections with individual accounts, per-account transaction sync buttons, last-synced timestamps, delete with confirmation |
| `apps/mobile/src/screens/LinkBankScreen.tsx` | Bank linking — searchable country & bank picker, opens auth in system browser |
| `apps/mobile/src/screens/AddManualAccountScreen.tsx` | Manual account entry — name, type (cash/investment), balance, gain fields |

## Architecture Overview

- **Monorepo** with npm workspaces (`apps/api`, `apps/mobile`)
- **Backend:** Express + Prisma (PostgreSQL) + TypeScript + Firebase Admin SDK for auth
- **Frontend:** React Native + Expo + React Native Paper + Firebase web SDK for client auth
- **Navigation:** React Navigation — root-level conditional (auth stack vs main app). Main app has bottom tabs (Overview, Goals, Family, Bank Accounts) with stack navigators for Goals and Bank Accounts tabs. Tab headers hidden for stack-based tabs; stack navigator owns the header for all nested screens.
- **Auth flow:** Firebase Auth (email/password with email verification). Client uses Firebase web SDK with AsyncStorage persistence. On registration, user is signed out until email verified. On first login after verification, backend User record is created via `POST /api/register` (idempotent — 409 ignored on subsequent logins). All API requests go through shared `apiFetch()` which auto-attaches Bearer token. See `docs/auth-flow.md` for full details.
- **API client:** Centralized `apiFetch()` in `src/config/api.ts` — wraps `fetch()` with auto-attached Firebase ID token and base URL from env. All screens use this instead of direct `fetch()`.
- **Scheduled jobs:** `node-cron` runs in-process. Cleanup of unverified users runs on `CLEANUP_CRON_SCHEDULE` (default daily at midnight).
- **Testing:** Vitest with contract tests against external services
- **Bank data:** Multi-provider abstraction (`BankDataProvider` interface) with three providers: GoCardless (PSD2 redirect flow), FinTS (ING DiBa credential-based, cash accounts only — depot pending HKWPD support), and Manual (user-entered balances, skipped during auto-refresh). Linking is provider-specific; data fetching is unified.
- **Account categories:** Cash (Giro, savings — balance only) and Investment (Depot — balance + gain amount/percentage)
- **Bank linking flows:** GoCardless (app → browser redirect → API callback → return to app), FinTS (API call with server-side credentials → immediate account creation), Manual (app form → API creates connection + initial balance)

## Data Models

- **User** — local user record linked to Firebase Auth (firebaseUid unique, displayName, email, createdAt). Created via `POST /api/register` on first login. Owns BankConnections and Goals (both cascade delete).
- **BankConnection** — a linked bank (userId FK → User, provider, institutionId, requisitionId, referenceId, status). Provider is `gocardless`, `fints`, or `manual`. Status is `pending` during GoCardless redirect flow, `linked` on completion. FinTS and manual connections are created directly as `linked`.
- **BankAccount** — individual account under a connection (externalId, name, ownerName, accountType, includedInTotal flag, lastSyncedAt?). Account type is `cash` or `investment`.
- **Balance** — account balance snapshot (amount, currency, balanceType, gainAmount?, gainPercentage?, fetchedAt). Gain fields are populated for investment accounts only.
- **Goal** — a financial savings goal (name, goalType as `balance_based`|`transaction_based`, targetAmount, initialAmount, matchPattern?, currency, deadline, interval as `weekly`|`monthly`, userId). Progress depends on goal type: balance-based = initialAmount + sum of linked account balances; transaction-based = initialAmount + sum of absolute values of matched outgoing transactions (case-insensitive, OR across comma-separated patterns).
- **Transaction** — individual transaction on an account (externalId unique for dedup, amount, currency, description, mandateReference?, creditorId?, remittanceInformation?, date). SEPA fields extracted from raw description at fetch time. Cascade deletes with BankAccount.
- **GoalAccount** — join table linking goals to bank accounts (composite PK on goalId + accountId, cascade delete both sides). Many-to-many: a goal can link multiple accounts, an account can belong to multiple goals.
- Relationships: User 1→N BankConnection, User 1→N Goal, BankConnection 1→N BankAccount, BankAccount 1→N Balance, BankAccount 1→N Transaction, Goal N↔N BankAccount (via GoalAccount)

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/bank-links/callback` | No | Callback after bank authorization — browser redirect, uses referenceId for identity (ADR-004) |
| POST | `/api/register` | Yes | Register user — creates local User record linked to Firebase UID |
| DELETE | `/api/account` | Yes | Delete authenticated user's account and all associated data (cascade) |
| GET | `/api/banks?country=XX` | Yes | List supported bank institutions for a country |
| POST | `/api/bank-links` | Yes | Initiate bank linking — creates pending connection, returns GoCardless redirect link |
| POST | `/api/bank-links/fints` | Yes | Link ING accounts via FinTS (credential-based, server-side) |
| POST | `/api/bank-links/manual` | Yes | Create manual bank connection with accounts |
| GET | `/api/bank-connections` | Yes | List bank connections with accounts for authenticated user |
| DELETE | `/api/bank-connections/:connectionId` | Yes | Cascade delete connection, accounts, and balances |
| POST | `/api/accounts/:accountId/balances/refresh` | Yes | Refresh balances for a single account |
| POST | `/api/accounts/balances/refresh` | Yes | Refresh balances for all accounts of authenticated user |
| POST | `/api/accounts/:accountId/balances` | Yes | Record a manual balance snapshot |
| PATCH | `/api/accounts/:accountId/include` | Yes | Toggle account include/exclude from total |
| GET | `/api/balances/summary` | Yes | Aggregated balance total + per-account breakdown for authenticated user |
| POST | `/api/goals` | Yes | Create a goal for authenticated user |
| GET | `/api/goals` | Yes | List goals with calculated progress for authenticated user |
| GET | `/api/goals/:goalId` | Yes | Goal detail with linked accounts and progress |
| PATCH | `/api/goals/:goalId` | Yes | Update goal fields |
| DELETE | `/api/goals/:goalId` | Yes | Delete a goal (cascades GoalAccount) |
| POST | `/api/goals/:goalId/accounts` | Yes | Link accounts to a goal |
| DELETE | `/api/goals/:goalId/accounts/:accountId` | Yes | Unlink an account from a goal |
| POST | `/api/accounts/:accountId/transactions/refresh` | Yes | Fetch & store transactions for an account |

## Conventions

- TypeScript everywhere, strict mode
- Routes in `src/routes/`, services in `src/services/`, tests in `__tests__/` colocated
- Screens in `apps/mobile/src/screens/`, config in `src/config/`, contexts in `src/contexts/`
- Env vars for secrets (loaded via dotenv on backend, `EXPO_PUBLIC_*` prefix on frontend)
- ADRs in `docs/adr/` numbered sequentially
- API base URL centralized in `src/config/api.ts` via `EXPO_PUBLIC_API_BASE_URL` env var
- All endpoints derive user identity from Firebase token (`req.uid`) — no userId in request body/query params
- All frontend API calls go through `apiFetch()` — never use `fetch()` directly for API requests

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `@prisma/client` | Database ORM |
| `nordigen-node` | GoCardless Bank Account Data SDK |
| `firebase-admin` | Firebase Admin SDK — token verification, user management |
| `firebase` | Firebase web SDK — client-side auth (email/password) |
| `dotenv` | Env var loading |
| `vitest` | Test framework |
| `expo` | Mobile app framework |
| `expo-secure-store` | Secure storage (installed but not used for auth persistence — see ADR-005) |
| `@react-native-async-storage/async-storage` | Auth state persistence for Firebase web SDK |
| `react-native-paper` | Material Design UI components |
| `@react-navigation/native` | Navigation framework |
| `@react-navigation/bottom-tabs` | Bottom tab navigator |
| `@react-navigation/native-stack` | Stack navigator |
| `node-cron` | In-process cron scheduler for scheduled jobs |
| `node-fints` | FinTS/HBCI client for German banks (ING DiBa) |
| `react-native-paper-dates` | Date picker components for React Native Paper |
