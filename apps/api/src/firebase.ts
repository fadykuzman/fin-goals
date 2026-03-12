import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS env var is required");
}

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

export const auth = getAuth(app);
