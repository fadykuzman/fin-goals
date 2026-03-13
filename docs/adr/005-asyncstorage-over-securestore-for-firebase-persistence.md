# ADR-005: Use AsyncStorage over SecureStore for Firebase Auth Persistence

## Status
Accepted

## Context
Firebase Auth's `initializeAuth` requires a persistence layer to keep users logged in across app restarts. Two options were considered for React Native:

1. **`expo-secure-store`** — encrypted storage backed by Android Keystore / iOS Keychain. Has a **2KB per-key value limit**.
2. **`@react-native-async-storage/async-storage`** — unencrypted key-value store with no size limit. Officially recommended by Firebase for React Native.

## Decision
Use `AsyncStorage` via `getReactNativePersistence(AsyncStorage)`.

## Rationale
- Firebase Auth persists the entire user credential blob (refresh token, user metadata, etc.) which can exceed `expo-secure-store`'s 2KB limit, causing silent failures — `onAuthStateChanged` never fires.
- `AsyncStorage` is the officially supported and documented option for Firebase Auth in React Native.
- The persisted data is primarily the refresh token. Firebase ID tokens are short-lived (1 hour) and auto-refreshed, limiting exposure from unencrypted storage.
- The security trade-off is acceptable: AsyncStorage stores data in plain text on disk, but the refresh token alone does not grant access without Firebase's servers, and device-level encryption (enabled by default on modern Android/iOS) provides an additional layer.

## Consequences
- Auth state persists across app restarts without size limit issues.
- Refresh tokens are stored unencrypted on disk (mitigated by device-level encryption and short-lived ID tokens).
