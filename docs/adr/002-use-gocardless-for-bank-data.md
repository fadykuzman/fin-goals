# ADR-002: Use GoCardless Bank Account Data for Bank Connectivity

## Status
Accepted

## Date
2026-03-11

## Context
We need a service to connect to users' bank accounts and retrieve transactions, balances, and account details. The main options considered were:

- **Plaid** — dominant in the US, limited European bank coverage, higher cost.
- **TrueLayer** — good UK/EU coverage, but smaller institution network than GoCardless.
- **GoCardless Bank Account Data (formerly Nordigen)** — broad European bank coverage via PSD2/Open Banking, free tier available, official Node.js SDK (`nordigen-node`).

Our primary target market is European users, and we need broad coverage of EU/UK banks at a reasonable cost.

## Decision
Use GoCardless Bank Account Data as the bank connectivity provider.

## Consequences
- **Positive:** Wide European bank coverage (2,500+ institutions), free tier for development and small-scale use, official Node.js SDK, PSD2-compliant.
- **Negative:** Limited coverage outside Europe. If we expand to US/other markets, we may need to integrate a second provider (e.g. Plaid).
