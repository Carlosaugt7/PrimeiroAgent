import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";

const EVO_BASE_FALLBACK = "https://evolution-api.rsconsultoria.pro";

function cleanPhoneNumber(num: string): string {
  if (!num) return "";
  return num.replace(/@.*$/, "").replace(/\D/g, "");
}

async function getGlobalEvoConfig(): Promise<{ url: string; key: string | undefined }> {
  try {
    const { data } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["evolutionApiUrl", "evolutionApiKey"]);
    if (data && data.length > 0) {
      const map = Object.fromEntries(
        data.map((r: { key: string; value: string }) => [r.key, r.value]),
      );
      const u = map.evolutionApiUrl?.trim();
      const k = map.evolutionApiKey?.trim();
      if (u && k) return { url: u.replace(/\/$/, ""), key: k };
    }
  } catch {
    /* usa fallback */
  }
  return { url: EVO_BASE_FALLBACK, key: process.env.EVOLUTION_API_KEY };
}

async function getEvoConfig(tenantId?: string): Promise<{ url: string; key: string | undefined }> {
  if (tenantId) {
    try {
      const { data: tenant } = await supabase
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
    } catch {
      /* ignora e usa global */
    }
  }
  return getGlobalEvoConfig();
}

async function evoSendText(
  instanceName: string,
  number: string,
  text: string,
  tenantId?: string,
): Promise<{ ok: boolean; httpStatus?: number; error?: string; attempts: number; latencyMs: number }> {
  const startedAt = Date.now();
  const target = cleanPhoneNumber(number);
  const cfg = await getEvoConfig(tenantId);
  if (!cfg.key) {
    return { ok: false, error: "EVOLUTION_API_KEY ausente", attempts: 0, latencyMs: 0 };
  }
  const baseDelayMs = 1000;
  const maxAttempts = 3;
  let lastErr: string | undefined;
  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(
        `${cfg.url}/message/sendText/${encodeURIComponent(instanceName)}`,
        {
          method: "POST",
          headers: { apikey: cfg.key, "Content-Type": "application/json" },
          body: JSON.stringify({ number: target, text }),
          signal: AbortSignal.timeout(15000),
        },
      );
      lastStatus = r.status;
      if (r.ok) {
        return {
          ok: true,
          httpStatus: r.status,
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
        };
      }
      lastErr = `sendText ${r.status}: ${(await r.text()).slice(0, 300)}`;
      const isTransient =
        r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504;
      if (!isTransient || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      const isTransient = /timeout|econn|network|fetch failed|503|502|500|429/i.test(msg);
      if (!isTransient || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  return {
    ok: false,
    httpStatus: lastStatus,
    error: lastErr || "unknown failure",
    attempts: maxAttempts,
    latencyMs: Date.now() - startedAt,
  };
}

function classifyDeliveryError(error_msg: string | undefined): string {
  if (!error_msg) return "unknown";
  if (/401|403|auth|api.?key/i.test(error_msg)) return "authentication";
  if (/404|instanc|not.?found/i.test(error_msg)) return "instance_not_found";
  if (/400|invalid.?number|numero/i.test(error_msg)) return "invalid_number";
  if (/429|rate.?limit/i.test(error_msg)) return "rate_limit";
  if (/500|502|503|504|timeout|econn|network|fetch failed/i.test(error_msg))
    return "server_or_network";
  return "other";
}

async function run() {
  const nowIso = new Date().toISOString();

  const { data: dueMessages, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduledAt", nowIso);

  if (error) throw new Error("Erro ao buscar scheduled_messages: " + error.message);

  const results: any[] = [];

  for (const m of dueMessages || []) {
    try {
      if (!m.instanceName || !m.number || !m.text) throw new Error("dados incompletos");

      const res = await evoSendText(m.instanceName, m.number, m.text, m.tenantId);

      if (res.ok) {
        await supabase
          .from("scheduled_messages")
          .update({
            status: "sent",
            sentAt: new Date().toISOString(),
            attempts: res.attempts,
          })
          .eq("id", m.id);
        results.push({ tenant: m.tenantId, id: m.id, ok: true, attempts: res.attempts });
      } else {
        await supabase
          .from("scheduled_messages")
          .update({
            status: "failed",
            error: res.error,
            sentAt: new Date().toISOString(),
            attempts: res.attempts,
          })
          .eq("id", m.id);

        try {
          await supabase.from("delivery_failures").insert({
            tenantId: m.tenantId,
            instanceName: m.instanceName,
            remoteJid: cleanPhoneNumber(m.number),
            conversationId: m.conversationId || null,
            errorType: classifyDeliveryError(res.error),
            errorMessage: (res.error || "").slice(0, 2000),
            httpStatus: res.httpStatus || null,
            retryCount: res.attempts,
            resolved: false,
            notificationSent: false,
            createdAt: new Date().toISOString(),
          });
        } catch {
          /* ignora se a tabela ainda nao existe */
        }

        results.push({
          tenant: m.tenantId,
          id: m.id,
          ok: false,
          error: res.error,
          attempts: res.attempts,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("scheduled_messages")
        .update({
          status: "failed",
          error: msg,
          sentAt: new Date().toISOString(),
        })
        .eq("id", m.id);
      results.push({ tenant: m.tenantId, id: m.id, ok: false, error: msg });
    }
  }

  return { ranAt: nowIso, processed: results.length, results };
}

export const Route = createFileRoute("/api/public/cron-send")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    new URL(request.url).searchParams.get("key") ?? request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const out = await run();
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
