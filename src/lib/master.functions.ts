import { createServerFn } from "@tanstack/react-start";
import { MASTER_ADMINS } from "@/lib/master";
import { setDoc, getDoc } from "@/lib/firebase-admin.server";

const FIREBASE_API_KEY = "AIzaSyBIHRfq0tKN6ELQP0NznDBAaFEVVQ_kUkU";

async function lookupUser(idToken: string) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!r.ok) throw new Error(`Token inválido: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { users?: Array<{ localId: string; email?: string }> };
  const u = j.users?.[0];
  if (!u) throw new Error("Usuário não encontrado para o token");
  return { uid: u.localId, email: (u.email || "").toLowerCase() };
}

async function requireMaster(idToken: string) {
  const u = await lookupUser(idToken);
  const allowed = MASTER_ADMINS.map((e) => e.toLowerCase()).includes(u.email);
  const doc = await getDoc(`master_admins/${u.uid}`);
  if (!allowed && !doc) throw new Error("Acesso negado: não é Master Admin");
  return u;
}

export const promoteSelfToMaster = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => d)
  .handler(async ({ data }) => {
    const u = await lookupUser(data.idToken);
    const allowed = MASTER_ADMINS.map((e) => e.toLowerCase()).includes(u.email);
    if (!allowed) throw new Error(`E-mail ${u.email} não está em MASTER_ADMINS`);
    await setDoc(`master_admins/${u.uid}`, {
      email: u.email,
      promotedAt: new Date().toISOString(),
    });
    return { ok: true, uid: u.uid, email: u.email };
  });

export const createTenantAsMaster = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string; name: string; plan?: string }) => d)
  .handler(async ({ data }) => {
    const master = await requireMaster(data.idToken);
    const name = data.name.trim();
    if (!name) throw new Error("Nome do cliente é obrigatório");
    const tenantId = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await setDoc(`tenants/${tenantId}`, {
      id: tenantId,
      name,
      ownerId: master.uid,
      plan: data.plan || "starter",
      status: "active",
      managedBy: master.uid,
      createdAt: now,
    });
    await setDoc(`tenants/${tenantId}/members/${master.uid}`, {
      uid: master.uid,
      email: master.email,
      displayName: "Master Admin",
      role: "owner",
      joinedAt: now,
    });
    return { ok: true, tenantId, name };
  });
