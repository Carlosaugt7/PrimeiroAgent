import { createServerFn } from "@tanstack/react-start";
import { MASTER_ADMINS } from "@/lib/master";
import { supabase } from "@/integrations/supabase/client";

async function lookupUser(accessToken: string) {
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) throw new Error(`Token inválido: ${error?.message}`);
  return { uid: user.id, email: (user.email || "").toLowerCase() };
}

async function requireMaster(accessToken: string) {
  const u = await lookupUser(accessToken);
  const allowed = MASTER_ADMINS.map((e) => e.toLowerCase()).includes(u.email);
  const { data: doc } = await supabase.from("master_admins").select("id").eq("id", u.uid).single();
  if (!allowed && !doc) throw new Error("Acesso negado: não é Master Admin");
  return u;
}

export const promoteSelfToMaster = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => d) // idToken is actually the access_token in Supabase
  .handler(async ({ data }) => {
    const u = await lookupUser(data.idToken);
    const allowed = MASTER_ADMINS.map((e) => e.toLowerCase()).includes(u.email);
    if (!allowed) throw new Error(`E-mail ${u.email} não está em MASTER_ADMINS`);
    await supabase.from("master_admins").upsert({
      id: u.uid,
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
    
    await supabase.from("tenants").upsert({
      id: tenantId,
      name,
      ownerId: master.uid,
      plan: data.plan || "starter",
      status: "active",
      managedBy: master.uid,
      createdAt: now,
    });
    
    await supabase.from("tenant_members").upsert({
      uid: master.uid,
      tenantId: tenantId,
      email: master.email,
      displayName: "Master Admin",
      role: "owner",
      joinedAt: now,
    });
    
    return { ok: true, tenantId, name };
  });
