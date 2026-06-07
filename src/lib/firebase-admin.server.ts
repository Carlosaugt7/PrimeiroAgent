import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

let app: App | null = null;

function getAdmin(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ausente no servidor");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Aceita também versão base64
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    parsed = JSON.parse(decoded);
  }
  app = initializeApp({
    credential: cert(parsed as Parameters<typeof cert>[0]),
    projectId: (parsed as { project_id?: string }).project_id,
  });
  return app;
}

export function adminDb() {
  return getFirestore(getAdmin());
}

export { FieldValue };
