# Building the APK

## Prerequisites

- Node.js
- Android SDK
- Java JDK
- EAS CLI (`npm install -g eas-cli`)
- Logged in to Expo (`npx eas login`)

## Build

Run from `apps/mobile/` (not from the project root):

```bash
cd apps/mobile
npx eas build --platform android --profile preview --local
```

The APK will be output to the current directory.

## Notes

- The `preview` profile builds an APK for direct installation. The `production` profile builds an AAB for Google Play.
- When prompted, accept creating an EAS project and generating a new Android keystore.
- Environment variables for the build are configured in `eas.json` under the `preview` profile.
