// Firestore REST client compatível com Cloudflare Workers (sem firebase-admin/gRPC).
// Usa a service account em FIREBASE_SERVICE_ACCOUNT_JSON para assinar JWT (RS256) via Web Crypto.

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cachedSA: ServiceAccount | null = null;
let cachedToken: { token: string; exp: number } | null = null;

function getSA(): ServiceAccount {
  if (cachedSA) return cachedSA;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ausente");
  let parsed: ServiceAccount;
  try { parsed = JSON.parse(raw); }
  catch { parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); }
  // Normaliza quebras de linha escapadas
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  cachedSA = parsed;
  return parsed;
}

function b64url(bytes: Uint8Array | string) {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const sa = getSA();
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat, exp: iat + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`OAuth token falhou: ${r.status} ${await r.text()}`);
  const json = (await r.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

// ===== Conversão JS <-> Firestore Value =====

const INCREMENT_TAG = Symbol.for("firestore.increment");

export const FieldValue = {
  increment(n: number) { return { [INCREMENT_TAG]: n }; },
};

function isIncrement(v: any): v is { [INCREMENT_TAG]: number } {
  return v && typeof v === "object" && INCREMENT_TAG in v;
}

function toValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || isIncrement(v)) continue;
    out[k] = toValue(v);
  }
  return out;
}
function fromValue(v: any): any {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return ((v.arrayValue?.values ?? []) as any[]).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue?.fields ?? {});
  return undefined;
}
function fromFields(f: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(f)) out[k] = fromValue(v);
  return out;
}

// ===== API pública =====

const BASE = "https://firestore.googleapis.com/v1";

function docName(path: string) {
  const sa = getSA();
  return `projects/${sa.project_id}/databases/(default)/documents/${path}`;
}

export async function getDoc(path: string): Promise<Record<string, any> | null> {
  const token = await getAccessToken();
  const r = await fetch(`${BASE}/${docName(path)}`, { headers: { authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getDoc ${path}: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { fields?: Record<string, any> };
  return fromFields(j.fields ?? {});
}

export async function setDoc(
  path: string,
  data: Record<string, any>,
  opts: { merge?: boolean } = {},
): Promise<void> {
  const token = await getAccessToken();
  const fields = toFields(data);
  const transforms = Object.entries(data)
    .filter(([, v]) => isIncrement(v))
    .map(([k, v]) => ({
      fieldPath: k,
      increment: { integerValue: String((v as any)[INCREMENT_TAG]) },
    }));

  const write: any = {
    update: { name: docName(path), fields },
    updateTransforms: transforms,
  };
  if (opts.merge) {
    write.updateMask = { fieldPaths: Object.keys(fields) };
  }

  const r = await fetch(`${BASE}/projects/${getSA().project_id}/databases/(default)/documents:commit`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ writes: [write] }),
  });
  if (!r.ok) throw new Error(`setDoc ${path}: ${r.status} ${await r.text()}`);
}
