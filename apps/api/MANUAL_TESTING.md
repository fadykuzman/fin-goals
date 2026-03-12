# Manual Testing — API Endpoints

Base URL: `http://localhost:3000`

## Health Check

```bash
curl http://localhost:3000/health
```

## Banks

### List institutions by country

```bash
curl "http://localhost:3000/api/banks?country=DE"
```

## Bank Links

### Initiate bank linking

```bash
curl -X POST http://localhost:3000/api/bank-links \
  -H "Content-Type: application/json" \
  -d '{
    "institutionId": "ING_INGDDEFF",
    "userId": "test-user-1",
    "redirectUrl": "http://localhost:3000/api/bank-links/callback"
  }'
```

### Callback after bank authorization

```bash
curl "http://localhost:3000/api/bank-links/callback?ref=<referenceId>"
```

Replace `<referenceId>` with the reference ID from the bank connection.

## Balances

### Refresh balances for a single account

```bash
curl -X POST http://localhost:3000/api/accounts/<accountId>/balances/refresh
```

Replace `<accountId>` with internal DB account ID (e.g. `c61cf846-1746-40da-accb-6fcd32d907e6`).

### Refresh balances for all accounts of a user

```bash
curl -X POST http://localhost:3000/api/accounts/balances/refresh \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-1"}'
```

## Transactions

### Fetch transactions for a single account (default: last 90 days)

```bash
curl -X POST http://localhost:3000/api/accounts/<accountId>/transactions/refresh
```

### Fetch transactions with date range

```bash
curl -X POST http://localhost:3000/api/accounts/<accountId>/transactions/refresh \
  -H "Content-Type: application/json" \
  -d '{"dateFrom": "2026-01-01", "dateTo": "2026-03-12"}'
```

Replace `<accountId>` with internal DB account ID.
