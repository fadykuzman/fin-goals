# Authentication & Identity Flow

## Overview
The app uses Firebase Auth for identity with a backend User table for local data ownership. All API requests are authenticated via Firebase ID tokens.

## Components

### Firebase Auth (Client-Side)
- Firebase web SDK (`firebase/auth`) — Expo-compatible, no native modules required
- Email/password registration and login
- Email verification required before API access
- Client obtains an ID token after login and sends it as `Authorization: Bearer <token>` on every API request
- Auth state persisted via `AsyncStorage` using `getReactNativePersistence` — keeps users logged in across app restarts. See ADR-005 for why AsyncStorage over SecureStore.

### Auth Middleware (Server-Side)
- `requireAuth` middleware on all `/api/*` routes
- Verifies the Firebase ID token via Firebase Admin SDK
- Rejects unverified emails with 403
- Sets `req.uid` (Firebase UID) for downstream handlers
- See ADR-003 for why identity is always derived from the token, never from request body/query

### User Registration
1. Client registers with Firebase Auth (email/password), sets display name, sends verification email
2. Client is signed out immediately — must verify email before logging in
3. User verifies email via link
4. On first login after verification, client calls `POST /api/register` with `{ displayName, email }` in body
5. Backend creates a `User` record linked to `req.uid` (Firebase UID)
6. Returns 409 if the Firebase UID is already registered (ignored — idempotent on subsequent logins)

### Request Authentication
1. Client sends request with `Authorization: Bearer <firebase-id-token>`
2. Auth middleware verifies token, sets `req.uid`
3. Route handler uses `req.uid` to scope all data access to the authenticated user

### Frontend Auth Navigation
- Root navigator conditionally renders an Auth stack or the main app (bottom tabs) based on `AuthContext` state
- `onAuthStateChanged` listener sets the current user; while loading, a spinner is shown
- Auth stack screens: Login → Register → CheckEmail → ForgotPassword
- On login: rejects unverified emails (signs out and shows error)
- On register: creates Firebase user, sets display name, sends verification email, calls `POST /api/register`, signs out, navigates to CheckEmail screen
- Shared API client (`apiFetch`) automatically attaches the Firebase ID token as `Authorization: Bearer <token>` to all requests

## Bank Linking (OAuth Callback Flow)

Bank linking via GoCardless uses a redirect-based flow where the user leaves the app to authorize at their bank, then is redirected back to our callback endpoint.

### Flow
1. Client calls `POST /api/bank-links` with `{ institutionId, redirectUrl }`
2. Backend generates a unique `referenceId`, stores it with the user's identity (`req.uid`) server-side, and initiates a GoCardless session
3. Backend returns the GoCardless authorization link to the client
4. Client opens the link in a browser — user authorizes at their bank
5. Bank redirects to our callback: `GET /api/bank-links/callback?ref=<referenceId>`
6. Backend looks up the `referenceId` to recover the userId and institutionId — no user identity in the URL
7. Backend creates the BankConnection and BankAccount records

### Why Server-Side State (Not URL Params)
The callback endpoint is hit via browser redirect, not from our app with a Bearer token, so `req.uid` is not available. Rather than passing userId in the redirect URL (which is tamperable), we store a `referenceId → userId` mapping server-side at initiation time and look it up on callback. See ADR-004 for the full decision record.

### Other Linking Flows
- **FinTS** (`POST /api/bank-links/fints`): No redirect. Server-side credential-based flow. Uses `req.uid` directly.
- **Manual** (`POST /api/bank-links/manual`): No redirect. Uses `req.uid` directly.
