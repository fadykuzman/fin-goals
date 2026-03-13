# ADR-003: Derive User Identity from Firebase Token, Not Request Body

## Status
Accepted

## Date
2026-03-13

## Context
The `POST /api/register` endpoint needs to associate a new User record with a Firebase UID. Two options:

1. **Accept `firebaseUid` in the request body** — the client sends the UID explicitly.
2. **Use `req.uid` from the verified Firebase token** — the auth middleware already verifies the ID token and sets `req.uid`.

Option 1 allows any authenticated user to register accounts under arbitrary Firebase UIDs, since the body is client-controlled. Option 2 guarantees the UID matches the caller's verified identity.

## Decision
Always derive the Firebase UID from `req.uid` (set by auth middleware) rather than accepting it in the request body. This applies to registration and any future endpoint that needs to identify the calling user.

## Consequences
- **Positive:** No UID spoofing — users can only create/access records for their own identity. No additional validation needed on the UID field.
- **Negative:** None significant. The auth middleware is already required on all `/api/*` routes.
