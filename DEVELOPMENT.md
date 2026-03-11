# Development

## Prerequisites
- Node.js
- Android emulator or physical device (for mobile)
- npm

## Install Dependencies
```bash
npm install
```

## Running the Apps

### API Server
```bash
npm run api
```

### Mobile App (Expo)

**Start Expo dev server (interactive menu):**
```bash
npm run mobile
```
From the interactive menu, press:
- `a` — open on Android
- `w` — open in web browser
- `r` — reload app
- `j` — open debugger

This lets you run mobile and web jointly from a single session.

**Start Android directly:**
```bash
npm run start -w apps/mobile -- --android
```

**Start web directly:**
```bash
npm run start -w apps/mobile -- --web
```
