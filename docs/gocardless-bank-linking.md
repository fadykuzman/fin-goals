# GoCardless Bank Account Data API — Linking Flow

## Overview

GoCardless Bank Account Data API allows connecting to users' bank accounts to access balances, transactions, and account details. It operates as an AISP (Account Information Service Provider) within the EEA.

- **Base URL:** `https://bankaccountdata.gocardless.com`
- **Product:** Bank Account Data (not the payments API)
- **Auth model:** Redirect-based flow using "requisitions" (not traditional OAuth)

## Linking Flow (5 Steps)

### 1. Get Access Token

POST to `/api/v2/token/new/` with `secret_id` and `secret_key` (from GoCardless portal).

- Access token expires in **24 hours**
- Refresh token expires in **30 days**
- This token is for **server-to-GoCardless** communication, not a per-user bank token

```
POST /api/v2/token/new/
{ "secret_id": "...", "secret_key": "..." }

Response:
{ "access": "...", "access_expires": 86400, "refresh": "...", "refresh_expires": 2592000 }
```

### 2. Choose Institution

User selects their bank. GoCardless provides an endpoint to list supported institutions by country.

Each institution has an ID like `REVOLUT_REVOGB21`.

### 3. Create End User Agreement (Optional)

Define the terms for accessing bank data:

- `max_historical_days` — how many days of transaction history (e.g. 180)
- `access_valid_for_days` — how long the connection stays active (e.g. 30)
- `access_scope` — array of `["balances", "details", "transactions"]`

```
POST /api/v2/agreements/enduser/
{
  "institution_id": "REVOLUT_REVOGB21",
  "max_historical_days": "180",
  "access_valid_for_days": "30",
  "access_scope": ["balances", "details", "transactions"]
}
```

If skipped, GoCardless uses default values.

### 4. Create Requisition

This generates the link the user follows to authorize at their bank.

```
POST /api/v2/requisitions/
{
  "redirect": "http://yourapp.com/callback",
  "institution_id": "REVOLUT_REVOGB21",
  "reference": "user-unique-id",
  "agreement": "<agreement-id-from-step-3>",
  "user_language": "EN"
}

Response:
{
  "id": "<requisition-id>",
  "status": "CR",
  "link": "https://ob.gocardless.com/psd2/start/<requisition-id>/<institution-id>",
  "accounts": [],
  ...
}
```

- `link` — the URL to redirect the user to for bank authorization
- `reference` — your internal reference (e.g. user ID)
- `status: "CR"` — created, pending authorization

### 5. User Redirected Back

After the user authorizes at their bank, they are redirected to your `redirect` URL. The requisition now contains `accounts` — an array of account IDs.

These account IDs can be used to fetch balances and transactions via:
- `GET /api/v2/accounts/{id}/balances/`
- `GET /api/v2/accounts/{id}/transactions/`

## What to Store Per User

- **Requisition ID** — represents the bank connection
- **Account IDs** — individual accounts within that connection
- **Agreement ID** — if custom agreements are used
- **Institution ID** — which bank was linked

## Key Considerations

- Access tokens need periodic refresh (24h expiry)
- Bank connections expire based on agreement terms (default varies)
- Users may need to re-authorize periodically
- One requisition can yield multiple accounts (e.g. current + savings)
