import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

const EVO_BASE_FALLBACK = "https://evolution-api.rsconsultoria.pro";

// Helper para usar cliente admin do Supabase em operações globais no servidor (bypassa RLS)
async function getAdminClient() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return supabase;
  }
}

// Busca a configuração global da Evolution API (definida pelo Master Admin)
async function getGlobalEvoConfig(): Promise<{ url: string; key: string | undefined }> {
  try {
    const db = await getAdminClient();
    const { data } = await db
      .from("global_settings")
      .select("key, value")
      .in("key", ["evolutionApiUrl", "evolutionApiKey"]);

    if (data && data.length > 0) {
      const map = Object.fromEntries(
        data.map((r: { key: string; value: string }) => [r.key, r.value]),
      );
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
  let r: Response;
  try {
    r = await fetch(`${cfg.url}${path}`, {
      ...init,
      headers: {
        ...(await authHeaders(tenantId)),
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  } catch (err) {
    throw new Error(
      `Não foi possível conectar à Evolution API em ${cfg.url}. Verifique se a API está online e acessível.`,
    );
  }

  const text = await r.text();
  if (!r.ok) {
    const errorMap: Record<number, string> = {
      401: "Erro de autenticação na Evolution API. Verifique a API Key configurada.",
      403: "Acesso negado pela Evolution API. Verifique permissões da chave.",
      404: "Endpoint ou instância não encontrada na Evolution API.",
      409: "Instância já existe na Evolution API.",
      422: "Dados inválidos enviados para a Evolution API.",
      500: "Erro interno no servidor da Evolution API.",
      503: "Serviço da Evolution API indisponível no momento.",
    };
    const msg = errorMap[r.status] || `Evolution API retornou erro ${r.status}`;
    throw new Error(`${msg} (${text.slice(0, 150)})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const updateGlobalEvolutionSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string; key: string }) => d)
  .handler(async ({ data }) => {
    const db = await getAdminClient();
    const { error: e1 } = await db
      .from("global_settings")
      .upsert({ key: "evolutionApiUrl", value: data.url.trim() }, { onConflict: "key" });
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await db
      .from("global_settings")
      .upsert({ key: "evolutionApiKey", value: data.key.trim() }, { onConflict: "key" });
    if (e2) throw new Error(e2.message);

    return { ok: true };
  });

export const getGlobalEvolutionSettings = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getAdminClient();
  const { data } = await db
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
    const res = await evo<Record<string, unknown> | Record<string, unknown>[]>(
      "/instance/fetchInstances",
      data.tenantId,
    );
    const arr = Array.isArray(res) ? res : [res];
    return arr.map((item) => {
      const i = item as Record<string, unknown>;
      const instanceObj = i?.instance as Record<string, unknown> | undefined;
      return {
        instanceName: (i?.name ?? instanceObj?.instanceName ?? i?.instanceName) as string,
        status: (i?.connectionStatus ?? instanceObj?.status ?? "unknown") as string,
        ownerJid: (i?.ownerJid ?? instanceObj?.owner ?? null) as string | null,
        profileName: (i?.profileName ?? null) as string | null,
      };
    });
  });

export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string; webhookUrl?: string }) => {
    if (!d?.instanceName || !/^[a-zA-Z0-9_-]{3,40}$/.test(d.instanceName))
      throw new Error("Nome inválido (3–40 chars: letras, números, _ -)");
    return d;
  })
  .handler(async ({ data }) => {
    // 1. Valida se a instância já está vinculada no Supabase (instance_index)
    const { data: existingIdx } = await supabase
      .from("instance_index")
      .select("tenantId")
      .eq("instanceName", data.instanceName)
      .maybeSingle();

    if (existingIdx) {
      if (existingIdx.tenantId === data.tenantId) {
        throw new Error(
          `Esta instância "${data.instanceName}" já está vinculada a este workspace.`,
        );
      } else {
        throw new Error(
          `A instância "${data.instanceName}" já está vinculada a outro workspace. Escolha outro nome ou desvincule-a primeiro.`,
        );
      }
    }

    // 2. Cria a instância na Evolution API
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

export const unlinkInstanceFromTenant = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    const { data: existingIdx } = await supabase
      .from("instance_index")
      .select("tenantId")
      .eq("instanceName", data.instanceName)
      .maybeSingle();

    if (!existingIdx || existingIdx.tenantId !== data.tenantId) {
      throw new Error(`Instância "${data.instanceName}" não está vinculada a este workspace.`);
    }

    try {
      await evo(`/instance/delete/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("[unlinkInstanceFromTenant] Aviso ao excluir na Evolution API:", e);
    }

    await supabase.from("instance_index").delete().eq("instanceName", data.instanceName);
    await supabase
      .from("instances")
      .delete()
      .eq("id", data.instanceName)
      .eq("tenantId", data.tenantId);

    return { ok: true, message: "Instância desvinculada com sucesso" };
  });

export const setWebhook = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string; webhookUrl: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/webhook/set/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          url: data.webhookUrl,
          enabled: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          webhookByEvents: false,
          webhookBase64: false,
        },
      }),
    });
    return { ok: true };
  });

export const connectInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    const r = (await evo<Record<string, unknown>>(
      `/instance/connect/${encodeURIComponent(data.instanceName)}`,
      data.tenantId,
    )) as Record<string, unknown>;
    const qrcodeObj = r?.qrcode as Record<string, unknown> | undefined;
    return {
      base64: (r?.base64 ?? qrcodeObj?.base64 ?? null) as string | null,
      code: (r?.code ?? qrcodeObj?.code ?? null) as string | null,
      pairingCode: (r?.pairingCode ?? null) as string | null,
    };
  });

export const instanceState = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    const r = (await evo<Record<string, unknown>>(
      `/instance/connectionState/${encodeURIComponent(data.instanceName)}`,
      data.tenantId,
    )) as Record<string, unknown>;
    const inst = r?.instance as Record<string, unknown> | undefined;
    return { state: (inst?.state ?? r?.state ?? "unknown") as string };
  });

export const restartInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string }) => d)
  .handler(async ({ data }) => {
    try {
      await evo(`/instance/restart/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
        method: "PUT",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Cannot PUT") || msg.includes("404")) {
        try {
          await evo(`/instance/restart/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
            method: "POST",
          });
          return { ok: true };
        } catch (e2: unknown) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          if (msg2.includes("Cannot POST") || msg2.includes("404")) {
            await evo(`/instance/restart/${encodeURIComponent(data.instanceName)}`, data.tenantId, {
              method: "GET",
            });
            return { ok: true };
          }
          throw e2;
        }
      }
      throw e;
    }
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
      const res = await evo<Record<string, unknown>[]>(
        `/group/fetchAllGroups/${encodeURIComponent(data.instanceName)}?getParticipants=false`,
        data.tenantId,
      );
      const arr = Array.isArray(res) ? res : [];
      return arr.map((item) => {
        const g = item as Record<string, unknown>;
        return {
          id: (g?.id ?? g?.jid) as string,
          name: (g?.subject ?? g?.name ?? "Grupo sem nome") as string,
          size: (g?.size ?? null) as number | null,
        };
      });
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
      const res = await evo<Record<string, unknown>[]>(
        `/chat/findContacts/${encodeURIComponent(data.instanceName)}`,
        data.tenantId,
        {
          method: "POST",
          body: JSON.stringify({ where: {} }),
        },
      );
      const arr = Array.isArray(res) ? res : [];
      return arr.map((item) => {
        const c = item as Record<string, unknown>;
        return {
          id: (c?.remoteJid ?? c?.jid ?? c?.id ?? "") as string,
          name: (c?.name ?? null) as string | null,
          pushName: (c?.pushName ?? c?.pushname ?? null) as string | null,
          verifiedName: (c?.verifiedName ?? null) as string | null,
        };
      });
    } catch (e) {
      console.warn("[fetchInstanceContacts] falhou:", e);
      return [];
    }
  });

export const fetchGroupParticipants = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; instanceName: string; groupJid: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await evo<Record<string, unknown> | Record<string, unknown>[]>(
        `/group/participants/${encodeURIComponent(data.instanceName)}?groupJid=${encodeURIComponent(data.groupJid)}`,
        data.tenantId,
      );
      const resObj = res as Record<string, unknown>;
      const participants = Array.isArray(res)
        ? res
        : (resObj?.participants as Record<string, unknown>[]) || [];
      return participants.map((item) => {
        const p = item as Record<string, unknown>;
        return {
          id: (p?.phoneNumber ?? p?.id ?? p?.jid ?? p?.number ?? "") as string,
          name: (p?.name ?? null) as string | null,
          pushName: (p?.pushName ?? p?.pushname ?? null) as string | null,
          verifiedName: (p?.verifiedName ?? null) as string | null,
          isAdmin: !!(p?.admin || p?.isAdmin || p?.adminJid),
          isSuperAdmin: !!p?.isSuperAdmin,
        };
      });
    } catch (e) {
      console.warn("[fetchGroupParticipants] falhou:", e);
      return [];
    }
  });
