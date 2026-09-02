import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(json);
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT is set but unreadable:", e.message);
    }
  }

  const file =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.resolve(__dirname, "../../serviceAccountKey.json");

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

let ready = false;
const credentials = loadCredentials();

if (credentials) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
    }
    ready = true;
  } catch (e) {
    console.error("Firebase admin init failed:", e.message);
  }
} else {
  console.warn("Firebase admin not configured - FCM pushes will be skipped");
}

export const firebaseReady = () => ready;
export const firebaseProjectId = credentials?.project_id || null;
export default admin;
