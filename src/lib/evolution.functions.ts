import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

const EVO_BASE_FALLBACK = "https://evolution-api.rsconsultoria.pro";

// Busca a configuração global da Evolution API (definida pelo Master Admin)
async function getGlobalEvoConfig(): Promise<{ url: string; key: string | undefined }> {
  try {
    const { data } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["evolutionApiUrl", "evolutionApiKey"]);

    if (data && data.length > 0) {
      const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
      const url = map.evolutionApiUrl?.trim();
      const key = map.evolutionApiKey?.trim();
      if (url && key) return { url: url.replace(/\/$/, ""), key };
    }
  } catch {
    // ignora falha e usa fallback de env
  }
  return {
    url: EVO_BASE_FALLBACK,
    key: process.env.EVOLUTION_API_KEY,
  };
}

function getAuthSupabase() {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      return createClient(url, key, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        },
      });
    }
  }
  return supabase;
}

// Função para buscar as credenciais do tenant
async function getTenantEvoConfig(tenantId?: string) {
  // 1. Tenant tem config própria → usa ela
  if (tenantId) {
    const authClient = getAuthSupabase();
    const { data: tenant } = await authClient
      .from("tenants")
      .select("evolutionApiUrl, evolutionApiKey")
      .eq("id", tenantId)
      .single();
    if (tenant?.evolutionApiUrl && tenant?.evolutionApiKey) {
      return {
        url: tenant.evolutionApiUrl.replace(/\/$/, ""),
        key: tenant.evolutionApiKey,
      };
    }
  }

  // 2. Sem config de tenant → usa a config global do Master Admin
  return getGlobalEvoConfig();
}

async function authHeaders(tenantId?: string) {
  const cfg = await getTenantEvoConfig(tenantId);
  if (!cfg.key) throw new Error("EVOLUTION_API_KEY ausente ou não configurada");
  return { apikey: cfg.key, "Content-Type": "application/json" } as Record<string, string>;
}

async function evo<T = unknown>(path: string, tenantId?: string, init?: RequestInit): Promise<T> {
  const cfg = await getTenantEvoConfig(tenantId);
  const r = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      ...(await authHeaders(tenantId)),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const updateGlobalEvolutionSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string; key: string }) => d)
  .handler(async ({ data }) => {
    const { error: e1 } = await supabase
      .from("global_settings")
      .upsert({ key: "evolutionApiUrl", value: data.url.trim() }, { onConflict: "key" });
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabase
      .from("global_settings")
      .upsert({ key: "evolutionApiKey", value: data.key.trim() }, { onConflict: "key" });
    if (e2) throw new Error(e2.message);

    return { ok: true };
  });

export const getGlobalEvolutionSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["evolutionApiUrl", "evolutionApiKey"]);

    const map = Object.fromEntries(
      (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    );
    return {
      url: map.evolutionApiUrl ?? "",
      key: map.evolutionApiKey ?? "",
    };
  });

export const testEvolutionConnection = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string; key: string }) => d)
  .handler(async ({ data }) => {
    try {
      const url = data.url.replace(/\/$/, "");
      const r = await fetch(`${url}/instance/fetchInstances`, {
        headers: { apikey: data.key, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

export const updateEvolutionSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; url: string; key: string }) => d)
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("tenants")
      .update({ evolutionApiUrl: data.url, evolutionApiKey: data.key })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInstances = createServerFn({ method: "GET" })
  .inputValidator((d: { tenantId: string }) => d)
  .handler(async ({ data }) => {
    const res = await evo<any>("/instance/fetchInstances", data.tenantId);
    const arr = Array.isArray(res) ? res : [res];
    return arr.map((i: any) => ({
      instanceName: i?.name ?? i?.instance?.instanceName ?? i?.instanceName,
      status: i?.connectionStatus ?? i?.instance?.status ?? "unknown",
      ownerJid: i?.ownerJid ?? i?.instance?.owner ?? null,
      profileName: i?.profileName ?? null,
    }));
  });

export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string; webhookUrl?: string }) => {
    if (!d?.instanceName || !/^[a-zA-Z0-9_-]{3,40}$/.test(d.instanceName))
      throw new Error("Nome inválido (3–40 chars: letras, números, _ -)");
    return d;
  })
  .handler(async ({ data }) => {
    await evo("/instance/create", data.tenantId, {
      method: "POST",
      body: JSON.stringify({
        instanceName: data.instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        ...(data.webhookUrl
          ? { webhook: { url: data.webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }
          : {}),
      }),
    });
    return { ok: true };
  });

export const connectInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    const r = await evo<any>(
      `/instance/connect/${encodeURIComponent(data.instanceName)}`,
      data.tenantId,
    );
    return {
      base64: (r?.base64 ?? r?.qrcode?.base64 ?? null) as string | null,
      code: (r?.code ?? r?.qrcode?.code ?? null) as string | null,
      pairingCode: (r?.pairingCode ?? null) as string | null,
    };
  });

export const instanceState = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    const r = await evo<any>(
      `/instance/connectionState/${encodeURIComponent(data.instanceName)}`,
      data.tenantId,
    );
    return { state: (r?.instance?.state ?? r?.state ?? "unknown") as string };
  });

export const restartInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/instance/restart/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
      method: "PUT",
    });
    return { ok: true };
  });

export const logoutInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/instance/logout/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
      method: "DELETE",
    });
    return { ok: true };
  });

export const deleteInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/instance/delete/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
      method: "DELETE",
    });
    return { ok: true };
  });

export const sendText = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string; number: string; text: string }) => {
    if (!d?.instanceName || !d?.number || !d?.text) throw new Error("Parâmetros inválidos");
    return d;
  })
  .handler(async ({ data }) => {
    await evo(`/message/sendText/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
      method: "POST",
      body: JSON.stringify({ number: data.number, text: data.text }),
    });
    return { ok: true };
  });

export const listGroups = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await evo<any>(
        `/group/fetchAllGroups/${encodeURIComponent(data.instanceName)}?getParticipants=false`,
        data.tenantId,
      );
      const arr = Array.isArray(res) ? res : [];
      return arr.map((g: any) => ({
        id: g?.id ?? g?.jid,
        name: g?.subject ?? g?.name ?? "Grupo sem nome",
        size: g?.size ?? null,
      }));
    } catch (e) {
      console.warn("[listGroups] falhou:", e);
      return [];
    }
  });

export const sendMedia = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      tenantId: string;
      instanceName: string;
      number: string;
      mediaUrl: string;
      mediaType: string;
      caption?: string;
    }) => {
      if (!d?.instanceName || !d?.number || !d?.mediaUrl || !d?.mediaType)
        throw new Error("Parâmetros inválidos");
      return d;
    },
  )
  .handler(async ({ data }) => {
    await evo(`/message/sendMedia/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
      method: "POST",
      body: JSON.stringify({
        number: data.number,
        mediatype: data.mediaType,
        media: data.mediaUrl,
        caption: data.caption ?? "",
      }),
    });
    return { ok: true };
  });

export const sendPresence = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      tenantId: string;
      instanceName: string;
      number: string;
      presence: "composing" | "recording" | "paused";
      delay?: number;
    }) => {
      if (!d?.instanceName || !d?.number || !d?.presence) throw new Error("Parâmetros inválidos");
      return d;
    },
  )
  .handler(async ({ data }) => {
    try {
      await evo(`/chat/sendPresence/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
        method: "POST",
        body: JSON.stringify({
          number: data.number,
          presence: data.presence,
          delay: data.delay ?? 3000,
        }),
      });
      return { ok: true };
    } catch (e) {
      console.warn("[sendPresence] falhou:", e);
      return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

export const fetchInstanceContacts = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await evo<any>(
        `/chat/findContacts/${encodeURIComponent(data.instanceName)}`,
        data.tenantId,
        {
          method: "POST",
          body: JSON.stringify({ where: {} }),
        }
      );
      const arr = Array.isArray(res) ? res : [];
      return arr.map((c: any) => ({
        id: c?.id ?? c?.jid ?? "",
        name: c?.name ?? null,
        pushName: c?.pushName ?? c?.pushname ?? null,
        verifiedName: c?.verifiedName ?? null,
      }));
    } catch (e) {
      console.warn("[fetchInstanceContacts] falhou:", e);
      return [];
    }
  });

export const fetchGroupParticipants = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string; groupJid: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await evo<any>(
        `/group/participants/${encodeURIComponent(data.instanceName)}?groupJid=${encodeURIComponent(data.groupJid)}`,
        data.tenantId
      );
      const participants = Array.isArray(res) ? res : (res?.participants || []);
      return participants.map((p: any) => ({
        id: p?.id ?? p?.jid ?? p?.number ?? "",
        name: p?.name ?? null,
        pushName: p?.pushName ?? p?.pushname ?? null,
        verifiedName: p?.verifiedName ?? null,
        isAdmin: !!(p?.admin || p?.isAdmin || p?.adminJid),
        isSuperAdmin: !!(p?.isSuperAdmin),
      }));
    } catch (e) {
      console.warn("[fetchGroupParticipants] falhou:", e);
      return [];
    }
  });

