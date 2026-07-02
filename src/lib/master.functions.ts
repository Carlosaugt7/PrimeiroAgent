import { createServerFn } from "@tanstack/react-start";
import { MASTER_ADMINS } from "@/lib/master";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";

function getAuthSupabase(accessToken: string) {
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables on server-side");
  }
  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
    },
  });
}

async function lookupUser(accessToken: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);
  if (error || !user) throw new Error(`Token inválido: ${error?.message}`);
  return { uid: user.id, email: (user.email || "").toLowerCase() };
}

async function requireMaster(accessToken: string) {
  const u = await lookupUser(accessToken);
  const allowed = MASTER_ADMINS.map((e) => e.toLowerCase()).includes(u.email);
  const { data: doc } = await supabaseAdmin
    .from("master_admins")
    .select("id")
    .eq("id", u.uid)
    .maybeSingle();
  if (!allowed && !doc) throw new Error("Acesso negado: não é Master Admin");
  return u;
}

export const promoteSelfToMaster = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => d)
  .handler(async ({ data }) => {
    const u = await lookupUser(data.idToken);
    const allowed = MASTER_ADMINS.map((e) => e.toLowerCase()).includes(u.email);
    if (!allowed) throw new Error(`E-mail ${u.email} não está em MASTER_ADMINS`);

    const authClient = getAuthSupabase(data.idToken);
    const { error } = await authClient.from("master_admins").upsert({
      id: u.uid,
    });
    if (error) throw new Error(error.message);
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

    const authClient = getAuthSupabase(data.idToken);

    const { error: tenantErr } = await authClient.from("tenants").upsert({
      id: tenantId,
      name,
      ownerId: master.uid,
      plan: data.plan || "starter",
      status: "active",
      createdAt: now,
    });
    if (tenantErr) throw new Error(`Erro ao criar tenant: ${tenantErr.message}`);

    const { error: memberErr } = await authClient.from("tenant_members").upsert({
      uid: master.uid,
      tenantId: tenantId,
      email: master.email,
      displayName: "Master Admin",
      role: "owner",
      joinedAt: now,
    });
    if (memberErr) throw new Error(`Erro ao vincular membro: ${memberErr.message}`);

    return { ok: true, tenantId, name };
  });

export const getMasterDashboardMetrics = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => d)
  .handler(async ({ data }) => {
    await requireMaster(data.idToken);

    // 1. Total Tenants
    const { count: totalTenants } = await supabaseAdmin
      .from("tenants")
      .select("*", { count: "exact", head: true });

    // 2. Total Agents
    const { count: totalAgents } = await supabaseAdmin
      .from("agents")
      .select("*", { count: "exact", head: true });

    // 3. WhatsApp Instances status counts
    const { data: instances } = await supabaseAdmin.from("instances").select("status");

    const totalInstances = instances?.length ?? 0;
    const onlineInstances = instances?.filter((i) => i.status === "online").length ?? 0;
    const offlineInstances = totalInstances - onlineInstances;

    // 4. Message Volume / Logs
    const { count: totalMessages } = await supabaseAdmin
      .from("ai_logs")
      .select("*", { count: "exact", head: true });

    // 5. Active Subscriptions Count (non-trial plan tenants)
    const { count: activeSubs } = await supabaseAdmin
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .neq("plan", "trial")
      .eq("status", "active");

    // 6. Recent Audit logs
    const { data: recentAudits } = await supabaseAdmin
      .from("audit")
      .select("action, targetLabel, actorEmail, createdAt")
      .order("createdAt", { ascending: false })
      .limit(10);

    return {
      totalTenants: totalTenants || 0,
      totalAgents: totalAgents || 0,
      totalInstances,
      onlineInstances,
      offlineInstances,
      totalMessages: totalMessages || 0,
      activeSubs: activeSubs || 0,
      recentAudits: recentAudits || [],
    };
  });

export const getGlobalBillingSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { idToken: string }) => d)
  .handler(async ({ data }) => {
    await requireMaster(data.idToken);
    const { data: rows } = await supabaseAdmin
      .from("global_settings")
      .select("key, value")
      .in("key", ["asaasApiKey", "asaasEnv", "asaasWebhookToken", "mercadoPagoAccessToken"]);

    const map = Object.fromEntries(
      (rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    );

    return {
      asaasApiKey: map.asaasApiKey ?? "",
      asaasEnv: map.asaasEnv ?? "sandbox",
      asaasWebhookToken: map.asaasWebhookToken ?? "",
      mercadoPagoAccessToken: map.mercadoPagoAccessToken ?? "",
    };
  });

export const updateGlobalBillingSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      idToken: string;
      asaasApiKey: string;
      asaasEnv: string;
      asaasWebhookToken: string;
      mercadoPagoAccessToken: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requireMaster(data.idToken);

    const settings = [
      { key: "asaasApiKey", value: data.asaasApiKey.trim() },
      { key: "asaasEnv", value: data.asaasEnv.trim() },
      { key: "asaasWebhookToken", value: data.asaasWebhookToken.trim() },
      { key: "mercadoPagoAccessToken", value: data.mercadoPagoAccessToken.trim() },
    ];

    for (const item of settings) {
      const { error } = await supabaseAdmin
        .from("global_settings")
        .upsert(item, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
