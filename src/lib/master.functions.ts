import { createServerFn } from "@tanstack/react-start";
import { MASTER_ADMINS } from "@/lib/master";
import { setDoc } from "@/lib/firebase-admin.server";

const FIREBASE_API_KEY = "AIzaSyBIHRfq0tKN6ELQP0NznDBAaFEVVQ_kUkU";

export const promoteSelfToMaster = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => d)
  .handler(async ({ data }) => {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: data.idToken }),
      },
    );
    if (!r.ok) throw new Error(`Token inválido: ${r.status} ${await r.text()}`);
    const j = (await r.json()) as { users?: Array<{ localId: string; email?: string }> };
    const u = j.users?.[0];
    if (!u) throw new Error("Usuário não encontrado para o token");
    const email = (u.email || "").toLowerCase();
    const allowed = MASTER_ADMINS.map((e) => e.toLowerCase());
    if (!allowed.includes(email)) {
      throw new Error(`E-mail ${email} não está em MASTER_ADMINS`);
    }
    await setDoc(`master_admins/${u.localId}`, {
      email,
      promotedAt: new Date().toISOString(),
    });
    return { ok: true, uid: u.localId, email };
  });
