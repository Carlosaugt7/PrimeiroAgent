import { createServerFn } from "@tanstack/react-start";

const EVO_BASE = "https://evolution-api.rsconsultoria.pro";

function authHeaders() {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY ausente no servidor");
  return { apikey: key, "Content-Type": "application/json" } as Record<string, string>;
}

async function evo<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${EVO_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

export const listInstances = createServerFn({ method: "GET" }).handler(async () => {
  const data = await evo<any>("/instance/fetchInstances");
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((i: any) => ({
    instanceName: i?.name ?? i?.instance?.instanceName ?? i?.instanceName,
    status: i?.connectionStatus ?? i?.instance?.status ?? "unknown",
    ownerJid: i?.ownerJid ?? i?.instance?.owner ?? null,
    profileName: i?.profileName ?? null,
  }));
});

export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string; webhookUrl?: string }) => {
    if (!d?.instanceName || !/^[a-zA-Z0-9_-]{3,40}$/.test(d.instanceName))
      throw new Error("Nome inválido (3–40 chars: letras, números, _ -)");
    return d;
  })
  .handler(async ({ data }) => {
    await evo("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: data.instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        ...(data.webhookUrl ? { webhook: { url: data.webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } } : {}),
      }),
    });
    return { ok: true };
  });

export const connectInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string }) => d)
  .handler(async ({ data }) => {
    const r = await evo<any>(`/instance/connect/${encodeURIComponent(data.instanceName)}`);
    return {
      base64: (r?.base64 ?? r?.qrcode?.base64 ?? null) as string | null,
      code: (r?.code ?? r?.qrcode?.code ?? null) as string | null,
      pairingCode: (r?.pairingCode ?? null) as string | null,
    };
  });

export const instanceState = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string }) => d)
  .handler(async ({ data }) => {
    const r = await evo<any>(`/instance/connectionState/${encodeURIComponent(data.instanceName)}`);
    return { state: (r?.instance?.state ?? r?.state ?? "unknown") as string };
  });

export const restartInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/instance/restart/${encodeURIComponent(data.instanceName)}`, { method: "PUT" });
    return { ok: true };
  });

export const logoutInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/instance/logout/${encodeURIComponent(data.instanceName)}`, { method: "DELETE" });
    return { ok: true };
  });

export const deleteInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string }) => d)
  .handler(async ({ data }) => {
    await evo(`/instance/delete/${encodeURIComponent(data.instanceName)}`, { method: "DELETE" });
    return { ok: true };
  });

export const sendText = createServerFn({ method: "POST" })
  .inputValidator((d: { instanceName: string; number: string; text: string }) => {
    if (!d?.instanceName || !d?.number || !d?.text) throw new Error("Parâmetros inválidos");
    return d;
  })
  .handler(async ({ data }) => {
    await evo(`/message/sendText/${encodeURIComponent(data.instanceName)}`, {
      method: "POST",
      body: JSON.stringify({ number: data.number, text: data.text }),
    });
    return { ok: true };
  });

