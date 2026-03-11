# ADR-001: Use Vitest as the Test Framework

## Status
Accepted

## Date
2026-03-11

## Context
We need a test framework for the backend (Node.js + TypeScript). The main candidates are Jest and Vitest.

Our project uses `tsx` for development and modern TypeScript with ESM. Jest requires additional transform configuration (`ts-jest` or `@swc/jest`) to work with TypeScript, while Vitest supports TypeScript and ESM natively with zero config.

## Decision
Use Vitest as the test framework across the project.

## Consequences
- **Positive:** Zero-config TypeScript/ESM support, fast execution, compatible with Jest's API (easy migration if needed), built-in config loading (e.g. dotenv via `setupFiles`).
- **Negative:** Smaller ecosystem than Jest, though rapidly growing. Less community content and fewer third-party integrations.
