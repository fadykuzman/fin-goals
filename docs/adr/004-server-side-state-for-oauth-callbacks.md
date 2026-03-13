# ADR-004: Server-Side State for OAuth Callback Identity

## Status
Accepted

## Date
2026-03-13

## Context
When a user initiates a bank linking flow (e.g. GoCardless), the backend redirects them to an external authorization page. After authorization, the bank redirects back to our callback endpoint. At that point, we need to know which user initiated the flow.

Three approaches were considered:

1. **Pass userId in the redirect URL** — append it as a query parameter. Simple, but exposes the userId in the URL and allows tampering (a user could change the userId to link accounts under someone else's identity).
2. **Server-side state lookup** — store a `referenceId → userId` mapping on the server at initiation time, then look it up on callback using the referenceId. This is the standard OAuth `state` parameter pattern.
3. **Signed token in redirect URL** — encode userId in a JWT or HMAC-signed string passed through the URL. Prevents tampering but adds token signing/verification complexity.

## Decision
Use server-side state (option 2). When the user initiates a bank linking flow, store the userId (from `req.uid`) alongside the `referenceId` in the database. On callback, look up the userId by `referenceId` instead of reading it from query parameters.

We already generate a unique `referenceId` per flow, so this requires no new identifiers — just persisting the association earlier.

## Consequences
- **Positive:** userId is never exposed in URLs. No tampering risk. Follows the standard OAuth state pattern. No cryptographic overhead.
- **Negative:** Requires storing state before the flow completes (a pending record or separate table). Orphaned records may accumulate if users abandon flows — a cleanup job can handle this later.
