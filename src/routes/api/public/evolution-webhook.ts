/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-escape */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";
import {
  googleCalendarGetAvailableSlots,
  googleCalendarCreateEvent,
  googleCalendarCancelEvent,
  googleCalendarListEvents,
  googleSheetsSearch,
  googleSheetsAppendRow,
} from "@/lib/google-integrations";

const EVO_BASE_FALLBACK = "https://evolution-api.rsconsultoria.pro";

// Busca config global da tabela global_settings
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

async function evoSendText(tenantId: string, instanceName: string, number: string, text: string) {
  // 1. Tenant tem config própria → usa ela
  if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("evolutionApiUrl, evolutionApiKey")
      .eq("id", tenantId)
      .single();
    if (tenant?.evolutionApiUrl && tenant?.evolutionApiKey) {
      const url = tenant.evolutionApiUrl.replace(/\/$/, "");
      const key = tenant.evolutionApiKey;
      const r = await fetch(`${url}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ number, text }),
      });
      if (!r.ok) throw new Error(`sendText ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return;
    }
  }

  // 2. Sem config de tenant → usa config global
  const cfg = await getGlobalEvoConfig();
  if (!cfg.key) throw new Error("EVOLUTION_API_KEY ausente ou não configurada");
  const r = await fetch(`${cfg.url}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) throw new Error(`sendText ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function evoDeleteMessage(
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  messageId: string,
) {
  try {
    let url = "";
    let key = "";
    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("evolutionApiUrl, evolutionApiKey")
        .eq("id", tenantId)
        .single();
      if (tenant?.evolutionApiUrl && tenant?.evolutionApiKey) {
        url = tenant.evolutionApiUrl.replace(/\/$/, "");
        key = tenant.evolutionApiKey;
      }
    }

    if (!url || !key) {
      const cfg = await getGlobalEvoConfig();
      if (!cfg.key) return;
      url = cfg.url;
      key = cfg.key;
    }

    const r = await fetch(
      `${url}/chat/deleteMessageForEveryone/${encodeURIComponent(instanceName)}`,
      {
        method: "DELETE",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteJid,
          fromMe: true,
          id: messageId,
        }),
      },
    );
    if (!r.ok) {
      console.warn(`[evoDeleteMessage] falhou ao deletar no WhatsApp: ${r.status}`);
    }
  } catch (e) {
    console.error("[evoDeleteMessage] erro:", e);
  }
}

async function getEvoConfig(tenantId: string) {
  if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("evolutionApiUrl, evolutionApiKey")
      .eq("id", tenantId)
      .single();
    if (tenant?.evolutionApiUrl && tenant?.evolutionApiKey) {
      return { url: tenant.evolutionApiUrl.replace(/\/$/, ""), key: tenant.evolutionApiKey };
    }
  }
  const cfg = await getGlobalEvoConfig();
  return { url: cfg.url, key: cfg.key };
}

async function evoGetBase64Media(tenantId: string, instanceName: string, messageId: string) {
  try {
    const cfg = await getEvoConfig(tenantId);
    if (!cfg.key) return null;

    const r = await fetch(
      `${cfg.url}/chat/getBase64FromMedia/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: { apikey: cfg.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            key: {
              id: messageId,
            },
          },
          convertToMp3: true,
        }),
      },
    );
    if (!r.ok) {
      console.warn(`[evoGetBase64Media] falhou: ${r.status}`);
      return null;
    }
    const res = (await r.json()) as { base64?: string };
    return res.base64 ?? null;
  } catch (e) {
    console.error("[evoGetBase64Media] erro:", e);
    return null;
  }
}

async function transcribeAudioWithOpenAI(
  apiKey: string,
  base64Data: string,
): Promise<string | null> {
  try {
    const base64Clean = base64Data.includes("base64,")
      ? base64Data.split("base64,")[1]
      : base64Data;
    const buffer = Buffer.from(base64Clean, "base64");

    const blob = new Blob([buffer], { type: "audio/mp3" });
    const formData = new FormData();
    formData.append("file", blob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!r.ok) {
      console.warn(`[Whisper] erro: ${r.status} - ${await r.text()}`);
      return null;
    }

    const j = (await r.json()) as { text: string };
    return j.text || null;
  } catch (e) {
    console.error("[Whisper] erro:", e);
    return null;
  }
}

async function getOpenAiApiKey(tenantId: string, agentProviderId?: string): Promise<string | null> {
  try {
    if (agentProviderId) {
      const { data: prov } = await supabase
        .from("llm_providers")
        .select("apiKey, kind")
        .eq("id", agentProviderId)
        .eq("tenantId", tenantId)
        .single();
      if (prov?.kind === "openai" && prov.apiKey) return prov.apiKey;
    }

    const { data: provs } = await supabase
      .from("llm_providers")
      .select("apiKey")
      .eq("tenantId", tenantId)
      .eq("kind", "openai")
      .limit(1);
    if (provs && provs.length > 0 && provs[0].apiKey) return provs[0].apiKey;

    return process.env.OPENAI_API_KEY ?? null;
  } catch {
    return process.env.OPENAI_API_KEY ?? null;
  }
}

async function generateElevenLabsAudio(
  tenantId: string,
  apiKey: string,
  voiceId: string,
  text: string,
): Promise<string | null> {
  try {
    const textHash = await getSHA256Hash(text);

    // 1. Verificar cache
    const { data: cached } = await supabase
      .from("voice_cache")
      .select("audioUrl")
      .eq("tenantId", tenantId)
      .eq("voiceId", voiceId)
      .eq("textHash", textHash)
      .maybeSingle();

    if (cached?.audioUrl) {
      console.log(`[ElevenLabs Cache] HIT: Usando áudio em cache para hash=${textHash}`);
      return cached.audioUrl;
    }

    console.log(`[ElevenLabs Cache] MISS: Chamando ElevenLabs para hash=${textHash}`);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `[ElevenLabs] Erro ao gerar áudio: ${response.status} - ${await response.text()}`,
      );
      return null;
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    const bucketName = "campaigns";
    const fileName = `voice-replies/${tenantId}/${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Storage] Erro ao fazer upload do áudio:`, uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    const audioUrl = urlData.publicUrl;

    if (audioUrl) {
      // Registrar no cache em background
      supabase
        .from("voice_cache")
        .upsert(
          { tenantId, voiceId, textHash, audioUrl },
          { onConflict: "tenantId,voiceId,textHash" },
        )
        .then(({ error }) => {
          if (error) console.error("[ElevenLabs Cache] Falha ao gravar cache:", error);
          else console.log("[ElevenLabs Cache] Áudio gravado no cache com sucesso.");
        });

      return audioUrl;
    }
    return null;
  } catch (e) {
    console.error("[ElevenLabs] Erro na síntese/upload:", e);
    return null;
  }
}

async function evoSendAudio(
  tenantId: string,
  instanceName: string,
  number: string,
  audioUrl: string,
) {
  const cfg = await getEvoConfig(tenantId);
  if (!cfg.key) throw new Error("EVOLUTION_API_KEY ausente ou não configurada");

  const r = await fetch(`${cfg.url}/message/sendAudio/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ number, audio: audioUrl }),
  });
  if (!r.ok) throw new Error(`sendAudio ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function evoSendPresence(
  tenantId: string,
  instanceName: string,
  number: string,
  presence: "composing" | "recording" | "paused",
) {
  try {
    const cfg = await getEvoConfig(tenantId);
    if (!cfg.key) return;
    await fetch(`${cfg.url}/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ number, presence }),
    });
  } catch (e) {
    console.warn("[evoSendPresence] erro:", e);
  }
}

async function evoSendButtons(
  tenantId: string,
  instanceName: string,
  number: string,
  text: string,
  buttons: string[],
) {
  try {
    const cfg = await getEvoConfig(tenantId);
    if (!cfg.key) throw new Error("EVOLUTION_API_KEY ausente ou não configurada");

    const r = await fetch(`${cfg.url}/message/sendButtons/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({
        number,
        title: "Opções disponíveis",
        description: text,
        footerText: "AgentFlow IA",
        buttons: buttons.map((btn, index) => ({
          text: btn,
          id: `btn_${index}_${Date.now()}`,
        })),
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.warn("[EvoButtons] Erro ao enviar botões nativos:", errText);
      // Fallback: enviar como texto comum formatado
      await evoSendText(
        tenantId,
        instanceName,
        number,
        `${text}\n\n*Escolha uma opção:*\n${buttons.map((b) => `👉 *${b}*`).join("\n")}`,
      );
    }
  } catch (e) {
    console.error("[EvoButtons] erro no envio, usando fallback de texto:", e);
    await evoSendText(
      tenantId,
      instanceName,
      number,
      `${text}\n\n*Escolha uma opção:*\n${buttons.map((b) => `👉 *${b}*`).join("\n")}`,
    );
  }
}

// ===== Motor de Automações =====
type AutoAction = { type: "addTag" | "pauseBot" | "reply" | "setStatus"; value: string };
interface AutoRule {
  id: string;
  name: string;
  enabled: boolean;
  matchType: "contains" | "equals" | "regex";
  pattern: string;
  caseSensitive?: boolean;
  actions: AutoAction[];
  order?: number;
}

function matches(rule: AutoRule, text: string): boolean {
  if (!rule.enabled || !rule.pattern) return false;
  const cs = !!rule.caseSensitive;
  const t = cs ? text : text.toLowerCase();
  const p = cs ? rule.pattern : rule.pattern.toLowerCase();
  if (rule.matchType === "equals") return t.trim() === p.trim();
  if (rule.matchType === "regex") {
    try {
      return new RegExp(rule.pattern, cs ? "" : "i").test(text);
    } catch {
      return false;
    }
  }
  // contains (lista separada por vírgula)
  return p
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((kw) => t.includes(kw));
}

interface ActionContext {
  tenantId: string;
  instanceName: string;
  number: string;
  convId: string;
  newTags: Set<string>;
  updates: Record<string, unknown>;
}

async function applyAction(
  act: AutoAction,
  ruleName: string,
  ctx: ActionContext,
): Promise<{ pauseBot: boolean; replied: boolean }> {
  let pauseBot = false;
  let replied = false;

  if (act.type === "addTag" && act.value) {
    ctx.newTags.add(act.value.trim());
  } else if (act.type === "pauseBot") {
    pauseBot = true;
    ctx.updates.botPaused = true;
  } else if (act.type === "setStatus" && act.value) {
    ctx.updates.status = act.value;
  } else if (act.type === "reply" && act.value) {
    try {
      await evoSendText(ctx.tenantId, ctx.instanceName, ctx.number, act.value);
      const rid = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await supabase.from("messages").upsert({
        id: rid,
        tenantId: ctx.tenantId,
        conversationId: ctx.convId,
        text: act.value,
        fromMe: true,
        createdAt: new Date().toISOString(),
        automation: ruleName,
      });
      replied = true;
    } catch (e) {
      console.error("[automation reply] erro:", e);
    }
  }

  return { pauseBot, replied };
}

async function runAutomations(
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  text: string,
  convId: string,
  currentConv: Record<string, unknown> | null,
): Promise<{ pauseBot: boolean; replied: boolean; triggered: string[] }> {
  const { data: rulesData } = await supabase
    .from("automations")
    .select("*")
    .eq("tenantId", tenantId);
  const rules = (rulesData || []) as unknown as AutoRule[];
  rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const triggered: string[] = [];
  const updates: Record<string, unknown> = {};
  const existingTags = Array.isArray(currentConv?.tags) ? (currentConv.tags as string[]) : [];
  const newTags = new Set<string>(existingTags);
  let pauseBot = false;
  let replied = false;
  const number = remoteJid.split("@")[0];

  for (const rule of rules) {
    if (!matches(rule, text)) continue;
    triggered.push(rule.name);
    const ctx: ActionContext = { tenantId, instanceName, number, convId, newTags, updates };
    for (const act of rule.actions ?? []) {
      const result = await applyAction(act, rule.name, ctx);
      if (result.pauseBot) pauseBot = true;
      if (result.replied) replied = true;
    }
  }

  if (newTags.size > existingTags.length) {
    updates.tags = [...newTags];
  }
  if (Object.keys(updates).length > 0) {
    await supabase.from("conversations").update(updates).eq("id", convId).eq("tenantId", tenantId);
  }
  return { pauseBot, replied, triggered };
}

// ===== RAG helpers =====

function cosine(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function embedQuery(
  provider: Record<string, unknown>,
  model: string,
  text: string,
): Promise<number[] | null> {
  try {
    const kind = provider.kind;
    if (kind === "google") {
      const modelName = model.startsWith("models/") ? model : `models/${model}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${encodeURIComponent(provider.apiKey as string)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          content: { parts: [{ text }] },
        }),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { embedding: { values: number[] } };
      return j.embedding?.values ?? null;
    }

    // OpenAI-compatível
    const base = ((provider.baseUrl as string)?.trim() || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    const r = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model, input: [text] }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data: { embedding: number[] }[] };
    return j.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

async function buildRagContext(tenantId: string, userText: string): Promise<string | null> {
  const { data: docs } = await supabase.from("knowledge").select("*").eq("tenantId", tenantId);
  if (!docs || docs.length === 0) return null;

  const docsWithEmbed = docs.filter((d: any) => d.embedProviderId && d.embedModel);
  if (docsWithEmbed.length === 0) return null;

  const groups: Record<string, { providerId: string; model: string; docs: any[] }> = {};
  for (const d of docsWithEmbed) {
    const key = `${d.embedProviderId}:::${d.embedModel}`;
    if (!groups[key]) {
      groups[key] = { providerId: d.embedProviderId, model: d.embedModel, docs: [] };
    }
    groups[key].docs.push(d);
  }

  const scored: Array<{ text: string; score: number }> = [];

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    const { data: embedProv } = await supabase
      .from("llm_providers")
      .select("*")
      .eq("id", group.providerId)
      .eq("tenantId", tenantId)
      .single();
    if (!embedProv || !embedProv.apiKey) continue;

    const qvec = await embedQuery(embedProv, group.model, userText);
    if (!qvec) continue;

    for (const d of group.docs) {
      const { data: chunks } = await supabase
        .from("knowledge_chunks")
        .select("*")
        .eq("knowledgeId", d.id)
        .limit(200);
      if (!chunks) continue;
      for (const c of chunks) {
        let embeddingArray: number[] = [];
        if (typeof c.embedding === "string") {
          try {
            embeddingArray = JSON.parse(c.embedding);
          } catch {
            embeddingArray = c.embedding
              .replace(/[\[\]]/g, "")
              .split(",")
              .map(Number);
          }
        } else if (Array.isArray(c.embedding)) {
          embeddingArray = c.embedding;
        }

        if (embeddingArray.length > 0 && typeof c.text === "string") {
          scored.push({ text: c.text, score: cosine(qvec, embeddingArray) });
        }
      }
    }
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 4).filter((s) => s.score > 0.2);
  if (top.length === 0) return null;

  return top.map((t, i) => `[${i + 1}] ${t.text}`).join("\n\n");
}

// ===== Funções de Agenda Clínica (Supabase) =====

const WORK_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

async function getAvailableSlots(
  tenantId: string,
  specialty: string,
  date: string,
): Promise<string[]> {
  try {
    const { data: booked } = await supabase
      .from("appointments")
      .select("time")
      .eq("tenantId", tenantId)
      .eq("specialty", specialty.trim().toLowerCase())
      .eq("date", date)
      .eq("status", "scheduled");

    const bookedHours = new Set((booked || []).map((b) => b.time));
    return WORK_HOURS.filter((h) => !bookedHours.has(h));
  } catch (err) {
    console.error("[getAvailableSlots] erro:", err);
    return [];
  }
}

async function createAppointment(
  tenantId: string,
  patientName: string,
  patientPhone: string,
  specialty: string,
  date: string,
  time: string,
): Promise<boolean> {
  try {
    const cleanPhone = patientPhone.replace(/\D/g, "");
    const { error } = await supabase.from("appointments").insert({
      tenantId,
      patientName,
      patientPhone: cleanPhone,
      specialty: specialty.trim().toLowerCase(),
      date,
      time,
      status: "scheduled",
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[createAppointment] erro:", err);
    return false;
  }
}

async function cancelAppointment(tenantId: string, patientPhone: string): Promise<string> {
  try {
    const cleanPhone = patientPhone.replace(/\D/g, "");
    const { data, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("tenantId", tenantId)
      .eq("patientPhone", cleanPhone)
      .eq("status", "scheduled")
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return "Nenhuma consulta ativa encontrada para este número de telefone.";
    }

    const first = data[0];
    return `Consulta de ${first.specialty} no dia ${first.date} às ${first.time} foi cancelada com sucesso!`;
  } catch (err) {
    console.error("[cancelAppointment] erro:", err);
    return "Erro ao processar o cancelamento no banco de dados.";
  }
}

// ===== LLM callers =====

// Retry com backoff exponencial para erros transitórios (503, 429, 502)
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isTransient = /503|502|429|UNAVAILABLE|high demand|overloaded|rate.?limit/i.test(msg);
      if (!isTransient || attempt === maxAttempts) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

async function getSHA256Hash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getEvoMediaBase64(
  tenantId: string,
  instanceName: string,
  messageKeyId: string,
): Promise<string | null> {
  try {
    const cfg = await getEvoConfig(tenantId);
    if (!cfg.key) return null;
    const r = await fetch(
      `${cfg.url}/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: { apikey: cfg.key, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            key: {
              id: messageKeyId,
            },
          },
        }),
      },
    );
    if (!r.ok) {
      console.warn("[getEvoMediaBase64] falhou na API:", await r.text());
      return null;
    }
    const j = (await r.json()) as { base64?: string };
    return j.base64 || null;
  } catch (e) {
    console.warn("[getEvoMediaBase64] erro:", e);
    return null;
  }
}

async function searchProducts(tenantId: string, query: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tenantId", tenantId)
      .eq("isActive", true)
      .ilike("name", `%${query}%`)
      .limit(8);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("[searchProducts] erro:", e);
    return [];
  }
}

async function updateConversationProfile(tenantId: string, convId: string) {
  try {
    console.log(
      `[profileUpdate] Iniciando atualização de perfil em background para conversa: ${convId}`,
    );
    const { data: messages } = await supabase
      .from("messages")
      .select("text, fromMe, bot")
      .eq("conversationId", convId)
      .order("createdAt", { ascending: false })
      .limit(15);

    if (!messages || messages.length === 0) return;

    const sortedMsg = [...messages].reverse();
    const chatLog = sortedMsg
      .map((m) => {
        const sender = m.fromMe ? (m.bot ? "Assistente" : "Atendente") : "Cliente";
        return `${sender}: ${m.text}`;
      })
      .join("\n");

    const { data: conv } = await supabase
      .from("conversations")
      .select("instanceName")
      .eq("id", convId)
      .single();
    if (!conv?.instanceName) return;

    const { data: agents } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
    const agent = (agents || []).find((a: any) => a.whatsappInstanceId === conv.instanceName);
    if (!agent?.providerId || !agent?.model) return;

    const { data: provider } = await supabase
      .from("llm_providers")
      .select("*")
      .eq("id", agent.providerId)
      .single();
    if (!provider?.apiKey) return;

    const summaryPrompt = `Você é um analisador de conversas de CRM. Analise o histórico do chat abaixo e retorne exatamente um objeto JSON (e NADA mais, sem blocos de código Markdown ou caracteres extras) contendo:
- "notes": Um perfil ultra-conciso (máximo 2 parágrafos) do cliente, contendo nome (se informado), necessidades principais, interesses ou planos discutidos e detalhes importantes.
- "score": Uma nota de 1 a 5 (número inteiro) que representa o nível de interesse do cliente (Lead Scoring):
  1 = Sem interesse / Spam.
  2 = Apenas tirando dúvidas casuais.
  3 = Demonstrando interesse genuíno nos produtos/serviços.
  4 = Altamente interessado, perguntando sobre preços, formas de pagamento ou agendamento.
  5 = Decidido a contratar / Agendamento confirmado / Venda fechada.

Histórico do Chat:\n${chatLog}`;

    const res = await callLLM(
      provider,
      agent,
      "Você é um classificador de leads que responde apenas em JSON válido.",
      summaryPrompt,
    );

    let notes = "";
    let score = 3; // valor padrão de fallback

    try {
      const cleanJson = res.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      notes = parsed.notes || "";
      score = typeof parsed.score === "number" ? parsed.score : parseInt(parsed.score) || 3;
    } catch {
      notes = res.text;
      score = 3;
    }

    if (notes && notes.trim()) {
      const { error } = await supabase
        .from("conversations")
        .update({
          profileNotes: notes.trim(),
          leadScore: score,
        })
        .eq("id", convId)
        .eq("tenantId", tenantId);
      if (error) throw error;
      console.log(`[profileUpdate] Perfil da conversa e Lead Score (${score}/5) atualizados.`);
    }
  } catch (e) {
    console.error("[profileUpdate] Erro ao resumir perfil da conversa:", e);
  }
}

async function callAnthropic(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
  imageBase64?: string | null,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const baseUrl = (provider.baseUrl as string)?.trim() || "";
  const base = (baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, "");

  let contentPayload: any = userText;
  if (imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    contentPayload = [
      { type: "text", text: userText },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64Data,
        },
      },
    ];
  }

  const r = await fetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: agent.model,
      system: systemPrompt,
      messages: [{ role: "user", content: contentPayload }],
      max_tokens: 1024,
      temperature: agent.temperature ?? 0.5,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  return {
    text: j.content?.[0]?.text ?? "",
    inputTokens: j.usage?.input_tokens ?? 0,
    outputTokens: j.usage?.output_tokens ?? 0,
  };
}

async function callGoogle(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
  imageBase64?: string | null,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(agent.model as string)}:generateContent?key=${encodeURIComponent(provider.apiKey as string)}`;
  return withRetry(async () => {
    const parts: any[] = [{ text: userText }];
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      });
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: agent.temperature ?? 0.5 },
      }),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
    };
    return {
      text: j.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
    };
  });
}

async function callOpenAICompat(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
  imageBase64?: string | null,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const baseUrl = (provider.baseUrl as string)?.trim() || "";
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return withRetry(async () => {
    let contentPayload: any = userText;
    if (imageBase64) {
      const formattedBase64 = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;
      contentPayload = [
        { type: "text", text: userText },
        {
          type: "image_url",
          image_url: {
            url: formattedBase64,
          },
        },
      ];
    }

    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: agent.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentPayload },
        ],
        temperature: agent.temperature ?? 0.5,
      }),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      inputTokens: j.usage?.prompt_tokens ?? 0,
      outputTokens: j.usage?.completion_tokens ?? 0,
    };
  });
}

async function callLLM(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
  tenantId?: string,
  imageBase64?: string | null,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  try {
    const kind = provider.kind;
    if (kind === "anthropic")
      return await callAnthropic(provider, agent, systemPrompt, userText, imageBase64);
    if (kind === "google")
      return await callGoogle(provider, agent, systemPrompt, userText, imageBase64);
    return await callOpenAICompat(provider, agent, systemPrompt, userText, imageBase64);
  } catch (err) {
    console.warn(
      `[callLLM] Falha no provedor principal (id=${provider.id}). Iniciando failover... Erro:`,
      err,
    );
    if (tenantId) {
      try {
        const { data: alternativeProvs } = await supabase
          .from("llm_providers")
          .select("*")
          .eq("tenantId", tenantId)
          .neq("id", provider.id);

        if (alternativeProvs && alternativeProvs.length > 0) {
          const fallbackProv = alternativeProvs[0];
          console.log(
            `[callLLM] Failover: Roteando para "${fallbackProv.name}" (${fallbackProv.kind})`,
          );

          let fallbackModel = agent.model;
          if (fallbackProv.kind === "google") fallbackModel = "gemini-1.5-flash";
          else if (fallbackProv.kind === "openai") fallbackModel = "gpt-4o-mini";
          else if (fallbackProv.kind === "anthropic") fallbackModel = "claude-3-5-haiku-20241022";
          else if (fallbackProv.models && fallbackProv.models.length > 0)
            fallbackModel = fallbackProv.models[0].id;

          const fallbackAgent = { ...agent, model: fallbackModel };

          if (fallbackProv.kind === "anthropic")
            return await callAnthropic(
              fallbackProv,
              fallbackAgent,
              systemPrompt,
              userText,
              imageBase64,
            );
          if (fallbackProv.kind === "google")
            return await callGoogle(
              fallbackProv,
              fallbackAgent,
              systemPrompt,
              userText,
              imageBase64,
            );
          return await callOpenAICompat(
            fallbackProv,
            fallbackAgent,
            systemPrompt,
            userText,
            imageBase64,
          );
        }
      } catch (fallbackErr) {
        console.error(`[callLLM] Falha no roteamento de contingência local:`, fallbackErr);
      }
    }
    throw err;
  }
}

// ===== Linha Dir// ===== Linha Direta (Comandos do Proprietário) =====

async function runDirectLine(
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  userText: string,
  convId: string,
  isAudioInput = false,
) {
  console.log(`[directLine] Iniciando atendimento da Linha Direta para ${instanceName}`);
  const t0 = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;

  // 1) Encontrar agente vinculado a esta instância
  const { data: agents } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
  const agent = (agents || []).find((a: any) => a.whatsappInstanceId === instanceName);
  if (!agent) {
    console.warn(`[directLine] Nenhum agente vinculado à instância "${instanceName}"`);
    return { skipped: "no-agent-linked" };
  }
  if (!agent.providerId || !agent.model) {
    console.warn(`[directLine] Agente incompleto`);
    return { skipped: "agent-incomplete" };
  }

  // 2) Carregar provider
  const { data: provider } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("id", agent.providerId)
    .eq("tenantId", tenantId)
    .single();
  if (!provider?.apiKey) {
    console.warn(`[directLine] API key não configurada`);
    return { skipped: "no-provider" };
  }

  // 3) Prompt de comando direto
  const directLineSystemPrompt = `Você é a central de comando do proprietário deste WhatsApp. O dono da conta acabou de lhe enviar uma mensagem (ou áudio).
Analise o que ele deseja e execute uma das seguintes ações retornando a tag correspondente exatamente no final da resposta:

1. Se ele deseja configurar uma mensagem de ausência/aviso para quando os clientes quiserem falar com ele (ex: "estarei em reunião", "estou ausente", "avise que...", "não posso atender"), extraia a mensagem/motivo de ausência e retorne exatamente no formato:
   [ACTION: set_away { "message": "A mensagem/aviso de ausência exata em português informando que ele está ocupado/ausente e responderá depois" }]
   
2. Se ele deseja limpar/desativar o aviso de ausência:
   [ACTION: clear_away {}]
   
3. Se ele deseja ver os agendamentos ou resumo do dia:
   [ACTION: get_summary {}]
   
Caso contrário, apenas responda de forma prestativa confirmando que entendeu ou explicando como ele pode usar os comandos (ex: "resumo do dia", "agendamento", "definir aviso de ausência").`;

  let reply = "";
  let llmError: string | null = null;
  try {
    const res = await callLLM(provider, agent, directLineSystemPrompt, userText, tenantId);
    reply = res.text.trim();
    inputTokens += res.inputTokens;
    outputTokens += res.outputTokens;
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e);
  }

  if (llmError) {
    console.error(`[directLine] Erro LLM:`, llmError);
    return { error: llmError };
  }
  if (!reply) return { skipped: "empty-reply" };

  // Interceptar ações
  if (reply.includes("[ACTION:")) {
    const actionRegex = /\[ACTION:\s*(\w+)\s*(\{.*?\})?\s*\]/;
    const match = reply.match(actionRegex);
    if (match) {
      const actionType = match[1];
      const actionArgsStr = match[2] || "{}";
      let actionResult = "";

      try {
        const args = JSON.parse(actionArgsStr) as Record<string, string>;
        if (actionType === "set_away") {
          const { error } = await supabase
            .from("agents")
            .update({ awayMessage: args.message })
            .eq("id", agent.id)
            .eq("tenantId", tenantId);
          if (error) throw error;
          actionResult = `Aviso de ausência definido para: "${args.message}"`;
        } else if (actionType === "clear_away") {
          const { error } = await supabase
            .from("agents")
            .update({ awayMessage: null })
            .eq("id", agent.id)
            .eq("tenantId", tenantId);
          if (error) throw error;
          actionResult = "Aviso de ausência desativado com sucesso.";
        } else if (actionType === "get_summary") {
          const today = new Date().toLocaleDateString("sv-SE"); // Formato AAAA-MM-DD local

          // 1. Buscar do banco local
          const { data: booked } = await supabase
            .from("appointments")
            .select("time, patientName, specialty")
            .eq("tenantId", tenantId)
            .eq("date", today)
            .eq("status", "scheduled");

          let localAppts = (booked || [])
            .map((b) => `- ${b.time}: ${b.patientName} (${b.specialty})`)
            .join("\n");
          if (!localAppts) localAppts = "Nenhum agendamento no banco local para hoje.";

          // 2. Buscar do Google Calendar (se integrado)
          let calAppts = "";
          try {
            const calRes = await googleCalendarListEvents(tenantId, today);
            if (!calRes.error && calRes.events.length > 0) {
              calAppts = calRes.events
                .map((e) => {
                  const time = e.start.includes("T")
                    ? e.start.split("T")[1].slice(0, 5)
                    : "Dia inteiro";
                  return `- ${time}: ${e.summary}`;
                })
                .join("\n");
            }
          } catch (e) {
            console.warn("[directLine] Falha ao listar Google Calendar:", e);
          }

          actionResult = `## Agendamentos de Hoje (${today}):\n\n### Banco Local:\n${localAppts}`;
          if (calAppts) {
            actionResult += `\n\n### Google Calendar:\n${calAppts}`;
          }
        }
      } catch (err) {
        actionResult = `Erro ao executar comando: ${err instanceof Error ? err.message : String(err)}`;
      }

      // Segunda chamada do LLM para formular a resposta amigável para o dono
      const feedbackSystemPrompt = `Você é o assistente pessoal do proprietário. Você executou a ação '${actionType}' com o seguinte resultado:\n"${actionResult}"\n\nFormule uma resposta simpática e profissional em português para o proprietário relatando o resultado.`;
      try {
        const res = await callLLM(
          provider,
          agent,
          feedbackSystemPrompt,
          `Resultado: ${actionResult}`,
          tenantId,
        );
        reply = res.text.trim();
        inputTokens += res.inputTokens;
        outputTokens += res.outputTokens;
      } catch (e) {
        reply = `Comando executado. ${actionResult}`;
      }
    }
  }

  reply = reply.replace(/\[ACTION:.*?\]/g, "").trim();

  // Enviar de volta ao dono
  const number = remoteJid.split("@")[0];
  await evoSendText(tenantId, instanceName, number, reply);

  // Registrar mensagem do bot
  const replyId = `bot_owner_${Date.now()}`;
  await supabase.from("messages").upsert({
    id: replyId,
    tenantId,
    conversationId: convId,
    text: reply,
    fromMe: true,
    bot: true,
    agentId: agent.id,
    createdAt: new Date().toISOString(),
  });

  // Registrar em ai_logs para faturamento/analytics
  const latencyMs = Date.now() - t0;
  try {
    const logId = `log_owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from("ai_logs").upsert({
      id: logId,
      tenantId,
      createdAt: new Date().toISOString(),
      agentId: agent.id,
      agentName: agent.name ?? "",
      providerId: agent.providerId,
      providerKind: provider.kind ?? "",
      model: agent.model ?? "",
      instanceName,
      remoteJid,
      conversationId: convId,
      userText: userText.slice(0, 2000),
      reply: reply.slice(0, 4000),
      systemPromptChars: directLineSystemPrompt.length,
      latencyMs,
      ok: !llmError && !!reply,
      error: llmError,
      inputTokens,
      outputTokens,
    });
  } catch (e) {
    console.warn("[ai_logs] directLine log falhou:", e);
  }

  return { ok: true };
}

// ===== Bridge principal =====

async function runBridge(
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  userText: string,
  convId: string,
  isAudioInput = false,
  imageBase64: string | null = null,
) {
  // 1) Encontrar agente vinculado a esta instância
  const { data: agents } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
  const agent = (agents || []).find((a: any) => a.whatsappInstanceId === instanceName);
  if (!agent) {
    console.warn(
      `[bridge] SKIP: Nenhum agente vinculado à instância "${instanceName}". Agentes do tenant: ${(agents || []).map((a: any) => `${a.name}(whatsappInstanceId=${a.whatsappInstanceId})`).join(", ") || "nenhum"}`,
    );
    return { skipped: "no-agent-linked" };
  }
  if (agent.autoReply === false) {
    console.warn(`[bridge] SKIP: Agente "${agent.name}" tem autoReply=false`);
    return { skipped: "auto-reply-off" };
  }
  if (!agent.providerId || !agent.model) {
    console.warn(
      `[bridge] SKIP: Agente "${agent.name}" incompleto — providerId=${agent.providerId}, model=${agent.model}`,
    );
    return { skipped: "agent-incomplete" };
  }
  console.log(`[bridge] Agente "${agent.name}" encontrado (id=${agent.id}, model=${agent.model})`);

  // 2) Carregar provider
  const { data: provider } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("id", agent.providerId)
    .eq("tenantId", tenantId)
    .single();
  if (!provider?.apiKey) return { skipped: "no-provider" };

  // 2.5) Carregar notas de perfil históricas da conversa
  let profileContext = "";
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .select("profileNotes, triageAnswers")
      .eq("id", convId)
      .eq("tenantId", tenantId)
      .single();
    if (conv?.profileNotes) {
      profileContext =
        `## PERFIL DO CLIENTE (MEMÓRIA HISTÓRICA)\n` +
        `Aqui estão notas sobre as preferências e histórico deste cliente:\n` +
        `"${conv.profileNotes}"\n\n`;
    }
  } catch (e) {
    console.warn("[bridge] falhou ao carregar profileNotes:", e);
  }

  // 3) RAG opcional
  let systemPrompt: string = (agent.systemPrompt as string) ?? "Você é um assistente útil.";
  systemPrompt =
    `${systemPrompt}\n\n## DETECÇÃO DE FRUSTRAÇÃO / IRRITAÇÃO\n` +
    `Se o cliente demonstrar irritação extrema, frustração ou exigir falar com humanos de forma ríspida, responda de forma muito educada e coloque a tag [FRUSTRATED] exatamente no final da sua resposta para que o atendimento humano assuma.\n\n`;

  try {
    const ragCtx = await buildRagContext(tenantId, userText);
    if (ragCtx) {
      systemPrompt =
        `${systemPrompt}\n\n## BASE DE CONHECIMENTO — FONTE ÚNICA DE VERDADE\n` +
        `Abaixo estão as únicas informações que você deve usar para responder o usuário.\n` +
        `REGRAS OBRIGATÓRIAS:\n` +
        `1. Responda SOMENTE com base nas informações abaixo. Nunca invente, suponha ou complemente com conhecimento externo.\n` +
        `2. Se a pergunta do usuário não for respondível com as informações abaixo, diga exatamente: "Vou verificar isso para você agora."\n` +
        `3. Não mencione que está consultando uma base de conhecimento ou documentos.\n` +
        `4. Não crie listas de itens, preços, planos ou funcionalidades que não estejam explicitamente descritos abaixo.\n\n${ragCtx}`;
    } else {
      systemPrompt =
        `${systemPrompt}\n\n## DIRETRIZ DE CONHECIMENTO LIMITADO\n` +
        `Se o usuário perguntar sobre detalhes específicos (planos, preços, canais, funcionalidades) que não estejam no seu prompt, responda: "Vou verificar isso para você agora." Nunca invente informações.`;
    }
  } catch (e) {
    console.warn("[bridge] RAG falhou:", e);
  }

  // 3.5) Buscar histórico de mensagens recentes (últimas 8 mensagens)
  let historyContext = "";
  try {
    const { data: hist } = await supabase
      .from("messages")
      .select("text, fromMe, bot")
      .eq("conversationId", convId)
      .order("createdAt", { ascending: false })
      .limit(8);

    if (hist && hist.length > 0) {
      // Reverter para ordem cronológica
      const sortedHist = [...hist].reverse();
      const formattedLines = sortedHist.map((m) => {
        const sender = m.fromMe ? "Helena" : "Cliente";
        return `[${sender}]: ${m.text}`;
      });
      historyContext =
        `## HISTÓRICO RECENTE DA CONVERSA\n` +
        `Use o histórico abaixo para saber o que já foi conversado, evitar repetir as mesmas perguntas ou saudações e manter a fluidez:\n\n` +
        formattedLines.join("\n") +
        "\n\n";
    }
  } catch (e) {
    console.warn("[bridge] falhou ao carregar histórico:", e);
  }

  let triageContext = "";
  if (conv?.triageAnswers && Object.keys(conv.triageAnswers).length > 0) {
    triageContext =
      `## INFORMAÇÕES COLETADAS NA TRIAGEM INICIAL\n` +
      Object.entries(conv.triageAnswers)
        .map(([q, a]) => `- Pergunta: ${q}\n  Resposta: ${a}`)
        .join("\n") +
      "\n\n";
  }

  // 4) Chamar LLM com instruções de Agendamento + Google integrations
  const systemPromptComAgendamento =
    `${systemPrompt}\n\n` +
    (profileContext ? `${profileContext}` : "") +
    (triageContext ? `${triageContext}` : "") +
    (historyContext ? `${historyContext}` : "") +
    `## AGENDAMENTO INTELIGENTE (SUPERPODERES)\n` +
    `Você é integrado em tempo real ao banco de dados da clínica. Sempre que precisar consultar vagas, criar ou cancelar agendamentos, emita a tag correspondente EXATAMENTE no final da sua resposta, e o sistema executará a ação:\n` +
    `1. Consultar horários livres para uma especialidade e data:\n` +
    `   [ACTION: check_availability { "specialty": "especialidade", "date": "AAAA-MM-DD" }]\n` +
    `2. Confirmar consulta (pergunte o nome do paciente antes!):\n` +
    `   [ACTION: book_appointment { "patientName": "Nome do Paciente", "specialty": "especialidade", "date": "AAAA-MM-DD", "time": "HH:MM" }]\n` +
    `3. Cancelar a consulta ativa do paciente atual (libera a vaga no banco):\n` +
    `   [ACTION: cancel_appointment {}]\n\n` +
    `## GOOGLE CALENDAR (AGENDA)\n` +
    `Você também pode acessar o Google Calendar para agendamentos. Use estas ações:\n` +
    `4. Verificar horários livres no Google Calendar:\n` +
    `   [ACTION: google_calendar_check { "date": "AAAA-MM-DD" }]\n` +
    `5. Criar evento no Google Calendar:\n` +
    `   [ACTION: google_calendar_book { "title": "Título", "date": "AAAA-MM-DD", "time": "HH:MM", "duration": 60 }]\n` +
    `6. Cancelar evento no Google Calendar:\n` +
    `   [ACTION: google_calendar_cancel { "eventId": "id_do_evento" }]\n\n` +
    `## GOOGLE SHEETS (PLANILHA DE CLIENTES)\n` +
    `Você pode consultar e adicionar dados na planilha de clientes:\n` +
    `7. Buscar cliente na planilha:\n` +
    `   [ACTION: google_sheets_search { "query": "nome ou telefone" }]\n` +
    `8. Adicionar novo registro na planilha:\n` +
    `   [ACTION: google_sheets_add { "values": ["Nome", "Telefone", "Email", "Observação"] }]\n\n` +
    `## CATÁLOGO DE PRODUTOS\n` +
    `Você pode pesquisar produtos do estoque/loja no catálogo para tirar dúvidas e fechar vendas:\n` +
    `9. Buscar produtos no catálogo:\n` +
    `   [ACTION: search_products { "query": "nome ou palavra-chave" }]\n\n` +
    `Nota: Emita apenas UMA tag por resposta. O usuário não verá essas tags [ACTION:].`;

  const t0 = Date.now();
  let reply = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let llmError: string | null = null;
  try {
    const res = await callLLM(
      provider,
      agent,
      systemPromptComAgendamento,
      userText,
      tenantId,
      imageBase64,
    );
    reply = res.text.trim();
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e);
  }

  // Interceptador e Processador de Ações (Function Calling)
  if (!llmError && reply.includes("[ACTION:")) {
    const actionRegex = /\[ACTION:\s*(\w+)\s*(\{.*?\})?\s*\]/;
    const match = reply.match(actionRegex);
    if (match) {
      const actionType = match[1];
      const actionArgsStr = match[2] || "{}";
      let actionResult = "";

      try {
        const args = JSON.parse(actionArgsStr) as Record<string, string>;
        if (actionType === "check_availability") {
          const slots = await getAvailableSlots(tenantId, args.specialty, args.date);
          if (slots.length > 0) {
            actionResult = `Horários disponíveis para ${args.specialty} em ${args.date}: ${slots.join(", ")}.`;
          } else {
            actionResult = `Não há horários disponíveis para ${args.specialty} em ${args.date}.`;
          }
        } else if (actionType === "book_appointment") {
          const number = remoteJid.split("@")[0];
          const ok = await createAppointment(
            tenantId,
            args.patientName,
            number,
            args.specialty,
            args.date,
            args.time,
          );
          if (ok) {
            actionResult = `Agendamento criado com sucesso para ${args.patientName} em ${args.date} às ${args.time} para a especialidade ${args.specialty}.`;
            // Registrar ROI
            supabase
              .from("conversations")
              .select("convertedValue")
              .eq("id", convId)
              .single()
              .then(({ data }) => {
                const currentVal = Number(data?.convertedValue || 0);
                supabase
                  .from("conversations")
                  .update({ convertedValue: currentVal + 120 })
                  .eq("id", convId)
                  .then(() => {});
              });
          } else {
            actionResult = `Falha ao criar agendamento no banco de dados.`;
          }
        } else if (actionType === "cancel_appointment") {
          const number = remoteJid.split("@")[0];
          actionResult = await cancelAppointment(tenantId, number);
        } else if (actionType === "google_calendar_check") {
          const slots = await googleCalendarGetAvailableSlots(tenantId, args.date);
          if (slots.length > 0) {
            actionResult = `Horários disponíveis no Google Calendar para ${args.date}: ${slots.join(", ")}.`;
          } else {
            actionResult = `Não há horários disponíveis no Google Calendar para ${args.date}.`;
          }
        } else if (actionType === "google_calendar_book") {
          const res = await googleCalendarCreateEvent(
            tenantId,
            args.title || "Agendamento",
            args.date,
            args.time,
            parseInt(args.duration || "60", 10),
          );
          if (res.ok) {
            actionResult = `Evento criado com sucesso no Google Calendar: "${args.title}" em ${args.date} às ${args.time}. ID: ${res.eventId}`;
            // Registrar ROI
            supabase
              .from("conversations")
              .select("convertedValue")
              .eq("id", convId)
              .single()
              .then(({ data }) => {
                const currentVal = Number(data?.convertedValue || 0);
                supabase
                  .from("conversations")
                  .update({ convertedValue: currentVal + 120 })
                  .eq("id", convId)
                  .then(() => {});
              });
          } else {
            actionResult = `Falha ao criar evento: ${res.error}`;
          }
        } else if (actionType === "google_calendar_cancel") {
          const res = await googleCalendarCancelEvent(tenantId, args.eventId);
          if (res.ok) {
            actionResult = `Evento cancelado com sucesso no Google Calendar.`;
          } else {
            actionResult = `Falha ao cancelar evento: ${res.error}`;
          }
        } else if (actionType === "google_sheets_search") {
          const res = await googleSheetsSearch(tenantId, args.query);
          if (res.error) {
            actionResult = `Erro ao buscar na planilha: ${res.error}`;
          } else if (res.rows.length === 0) {
            actionResult = `Nenhum resultado encontrado na planilha para "${args.query}".`;
          } else {
            const headerLine = res.headers.join(" | ");
            const rowLines = res.rows.map((r) => r.join(" | ")).join("\n");
            actionResult = `Resultados encontrados (${res.rows.length}):\nColunas: ${headerLine}\n${rowLines}`;
          }
        } else if (actionType === "google_sheets_add") {
          const values = Array.isArray(args.values) ? args.values : [args.values];
          const res = await googleSheetsAppendRow(tenantId, values);
          if (res.ok) {
            actionResult = `Registro adicionado com sucesso na planilha.`;
          } else {
            actionResult = `Falha ao adicionar registro: ${res.error}`;
          }
        } else if (actionType === "search_products") {
          const items = await searchProducts(tenantId, args.query || "");
          if (items.length === 0) {
            actionResult = `Nenhum produto correspondente encontrado no catálogo para "${args.query}".`;
          } else {
            actionResult =
              `Produtos encontrados no catálogo:\n` +
              items
                .map(
                  (i) =>
                    `- SKU: ${i.sku || "N/A"} | Nome: ${i.name} | Preço: R$ ${i.price} | Descrição: ${i.description || "N/A"} | Link: ${i.linkUrl || "N/A"}`,
                )
                .join("\n");
          }
        } else {
          actionResult = `Ação desconhecida: ${actionType}`;
        }
      } catch (err: unknown) {
        actionResult = `Erro ao processar argumentos da ação: ${err instanceof Error ? err.message : String(err)}`;
      }

      // Segunda chamada do LLM com o resultado para gerar a resposta conversacional final
      const feedbackSystemPrompt =
        `${systemPrompt}\n\n` +
        `## RESULTADO DA AÇÃO EXECUTADA NO BANCO\n` +
        `Você acionou a ação '${actionType}' e o sistema retornou:\n` +
        `"${actionResult}"\n\n` +
        `Agora, formule uma resposta amigável e simpática em português para o paciente informando o resultado. Não emita nenhuma tag [ACTION:] nesta resposta final.`;

      try {
        const res = await callLLM(
          provider,
          agent,
          feedbackSystemPrompt,
          `Resultado do sistema: ${actionResult}`,
          tenantId,
        );
        reply = res.text.trim();
        inputTokens += res.inputTokens;
        outputTokens += res.outputTokens;
      } catch (e) {
        llmError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  // Remove qualquer tag ACTION remanescente na resposta por segurança
  reply = reply.replace(/\[ACTION:.*?\]/g, "").trim();

  const latencyMs = Date.now() - t0;

  const ragSuccess = !reply.includes("Vou verificar isso para você agora.");

  // 5) Log de trace
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from("ai_logs").upsert({
      id: logId,
      tenantId,
      createdAt: new Date().toISOString(),
      agentId: agent.id,
      agentName: agent.name ?? "",
      providerId: agent.providerId,
      providerKind: provider.kind ?? "",
      model: agent.model ?? "",
      instanceName,
      remoteJid,
      conversationId: convId,
      userText: userText.slice(0, 2000),
      reply: reply.slice(0, 4000),
      systemPromptChars: systemPrompt.length,
      latencyMs,
      ok: !llmError && !!reply,
      error: llmError,
      inputTokens,
      outputTokens,
      ragSuccess,
    });
  } catch (e) {
    console.warn("[ai_logs] falhou:", e);
  }

  if (llmError) return { error: llmError, latencyMs };
  if (!reply) return { skipped: "empty-reply", latencyMs };

  // 6) Enviar via WhatsApp ou Voz
  const number = remoteJid.split("@")[0];
  let sentAudioUrl: string | null = null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("elevenlabsApiKey")
    .eq("id", tenantId)
    .single();

  const shouldRespondVoice =
    (isAudioInput && agent.voiceResponseMode === "audio_only_on_audio") ||
    agent.voiceResponseMode === "always_audio";

  if (shouldRespondVoice && tenant?.elevenlabsApiKey && agent.elevenlabsVoiceId) {
    console.log(
      `[bridge] Gerando resposta de voz via ElevenLabs para voiceId=${agent.elevenlabsVoiceId}`,
    );
    try {
      const audioUrl = await generateElevenLabsAudio(
        tenantId,
        tenant.elevenlabsApiKey,
        agent.elevenlabsVoiceId,
        reply,
      );
      if (audioUrl) {
        sentAudioUrl = audioUrl;
        console.log(`[bridge] Áudio gerado: ${audioUrl}. Enviando ao WhatsApp...`);
        // Presença de gravação humana
        await evoSendPresence(tenantId, instanceName, number, "recording");
        await new Promise((r) => setTimeout(r, 4000));
        await evoSendPresence(tenantId, instanceName, number, "paused");

        await evoSendAudio(tenantId, instanceName, number, audioUrl);
      } else {
        console.warn("[bridge] Falha na geração do áudio. Usando texto de fallback.");
        // Presença de digitação humana
        await evoSendPresence(tenantId, instanceName, number, "composing");
        await new Promise((r) => setTimeout(r, Math.min(3000, reply.length * 15)));
        await evoSendPresence(tenantId, instanceName, number, "paused");

        await evoSendText(tenantId, instanceName, number, reply);
      }
    } catch (e) {
      console.error("[bridge] Erro ao enviar áudio. Usando texto de fallback:", e);
      // Presença de digitação humana
      await evoSendPresence(tenantId, instanceName, number, "composing");
      await new Promise((r) => setTimeout(r, Math.min(3000, reply.length * 15)));
      await evoSendPresence(tenantId, instanceName, number, "paused");

      await evoSendText(tenantId, instanceName, number, reply);
    }
  } else {
    // Verificar se a resposta tem a tag de botões interativos
    const buttonRegex = /\[BUTTONS:\s*(.*?)\s*\]/i;
    const btnMatch = reply.match(buttonRegex);
    if (btnMatch) {
      const buttons = btnMatch[1]
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      const cleanReply = reply.replace(buttonRegex, "").trim();

      // Presença de digitação humana
      await evoSendPresence(tenantId, instanceName, number, "composing");
      await new Promise((r) => setTimeout(r, Math.min(3000, cleanReply.length * 15)));
      await evoSendPresence(tenantId, instanceName, number, "paused");

      await evoSendButtons(tenantId, instanceName, number, cleanReply, buttons);
    } else {
      // Presença de digitação humana
      await evoSendPresence(tenantId, instanceName, number, "composing");
      await new Promise((r) => setTimeout(r, Math.min(3000, reply.length * 15)));
      await evoSendPresence(tenantId, instanceName, number, "paused");

      await evoSendText(tenantId, instanceName, number, reply);
    }
  }

  // 7) Registrar resposta do bot no Supabase
  const replyId = `bot_${Date.now()}`;
  await supabase.from("messages").upsert({
    id: replyId,
    tenantId,
    conversationId: convId,
    text: sentAudioUrl ? `[áudio] ${reply}` : reply,
    fromMe: true,
    bot: true,
    agentId: agent.id,
    createdAt: new Date().toISOString(),
  });

  // Verifica se a resposta da IA indica transferência para suporte especializado ou frustração
  const isFrustrated = reply.includes("[FRUSTRATED]");
  if (isFrustrated) {
    reply = reply.replace("[FRUSTRATED]", "").trim();
  }
  const isHandoff =
    isFrustrated ||
    /encaminhar seu atendimento|equipe especializada|suporte especializado/i.test(reply);

  const convUpdatePayload: Record<string, any> = {
    lastMessage: reply.slice(0, 200),
    updatedAt: new Date().toISOString(),
  };

  if (isHandoff) {
    console.log(
      `[bridge] Resposta da IA contêm gatilho de handoff/frustração. Pausando bot para a conversa ${convId}.`,
    );
    convUpdatePayload.botPaused = true;
    convUpdatePayload.status = "handoff";
    if (isFrustrated) {
      convUpdatePayload.isFrustrated = true;
    }
    if (agent.awayMessage) {
      console.log(
        `[bridge] Substituindo resposta padrão de handoff pelo aviso de ausência do proprietário: "${agent.awayMessage}"`,
      );
      reply = agent.awayMessage;
    }
  }

  await supabase
    .from("conversations")
    .update(convUpdatePayload)
    .eq("id", convId)
    .eq("tenantId", tenantId);

  // Atualizar perfil/score do lead em background (não bloqueante)
  updateConversationProfile(tenantId, convId).catch((err) => {
    console.error("[profileUpdate] background error:", err);
  });

  return { ok: true, agent: agent.id, latencyMs };
}

// ===== Handler do webhook =====

function resolveInstanceStatus(state: string): string {
  if (state === "open") return "online";
  if (state === "connecting") return "conectando";
  return "offline";
}

async function handleMessage(
  tenantId: string,
  instanceName: string,
  body: Record<string, unknown>,
) {
  const m = (body?.data ?? body?.message ?? body) as Record<string, unknown>;
  const key = (m?.key ?? {}) as Record<string, unknown>;
  const remoteJid: string | undefined = (key.remoteJid ?? m?.remoteJid) as string | undefined;
  if (!remoteJid) return new Response("no remoteJid", { status: 200 });
  if (remoteJid.endsWith("@g.us")) return Response.json({ ok: true, ignored: "group" });

  const fromMe: boolean = !!key.fromMe;
  const rawSender = body?.sender ?? (body as any)?.data?.sender ?? (body as any)?.instance?.owner;
  const ownerJid = typeof rawSender === "string" ? rawSender : undefined;
  const isDirectLine = fromMe && !!ownerJid && remoteJid === ownerJid;

  const messageId: string = (key.id as string) ?? `${Date.now()}`;
  const msgData = m?.message as Record<string, unknown> | undefined;
  const isAudio = !!msgData?.audioMessage;
  const isImage = !!msgData?.imageMessage;
  let text: string =
    (msgData?.conversation as string) ??
    ((msgData?.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    ((msgData?.imageMessage as any)?.caption as string) ??
    (m?.text as string) ??
    (isAudio ? "[áudio]" : isImage ? "[imagem]" : "[mídia]");
  const pushName: string = (m?.pushName as string) ?? remoteJid.split("@")[0];
  const convId = remoteJid.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Transcrição de áudio recebido do cliente ou do dono (linha direta)
  if (isAudio && (!fromMe || isDirectLine)) {
    console.log(`[webhook] Detectado áudio recebido. Tentando obter transcrição...`);
    // 1. Tentar pegar transcrição nativa da Evolution API se estiver disponível
    const audioText = (msgData?.audioMessage as any)?.text || (m as any)?.text;
    if (audioText && audioText !== "[áudio]" && audioText !== "[mídia]") {
      text = audioText;
      console.log(`[webhook] Transcrição nativa da Evolution API obtida: "${text}"`);
    } else {
      // 2. Transcrição ativa baixando mídia e enviando ao Whisper
      try {
        const base64Audio = await evoGetBase64Media(tenantId, instanceName, messageId);
        if (base64Audio) {
          const { data: agents } = await supabase
            .from("agents")
            .select("*")
            .eq("tenantId", tenantId);
          const agent = (agents || []).find((a: any) => a.whatsappInstanceId === instanceName);
          const openAiKey = await getOpenAiApiKey(tenantId, agent?.providerId);
          if (openAiKey) {
            const transcribed = await transcribeAudioWithOpenAI(openAiKey, base64Audio);
            if (transcribed) {
              text = transcribed;
              console.log(`[webhook] Transcrição bem-sucedida do Whisper: "${text}"`);
            } else {
              console.warn(`[webhook] Whisper retornou transcrição nula ou vazia.`);
            }
          } else {
            console.warn(`[webhook] OpenAI API key não localizada para o tenant ${tenantId}`);
          }
        } else {
          console.warn(`[webhook] Falha ao baixar áudio da Evolution API.`);
        }
      } catch (err) {
        console.error("[webhook] Erro ao obter áudio/transcrição:", err);
      }
    }
  }

  // Fetch current conversation
  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", convId)
    .eq("tenantId", tenantId)
    .single();

  await supabase.from("conversations").upsert({
    id: convId,
    tenantId,
    instanceName,
    contactName: pushName,
    contactPhone: remoteJid.split("@")[0],
    remoteJid,
    lastMessage: text.slice(0, 200),
    updatedAt: new Date().toISOString(),
    status: "aberta",
    unread: fromMe ? 0 : ((conv?.unread as number) || 0) + 1,
  });

  await supabase.from("messages").upsert({
    id: messageId,
    tenantId,
    conversationId: convId,
    text,
    fromMe,
    createdAt: new Date().toISOString(),
  });

  // Lógica de controle do Bot via WhatsApp (atendente interage pelo celular ou Dono envia comandos)
  if (fromMe) {
    if (isDirectLine) {
      console.log(`[webhook] ⚡ Linha Direta: Comando recebido do dono: "${text}"`);
      try {
        const directResult = await runDirectLine(
          tenantId,
          instanceName,
          remoteJid,
          text,
          convId,
          isAudio,
        );
        return Response.json({ ok: true, directLine: directResult });
      } catch (e) {
        console.error("[directLine] erro:", e);
        return Response.json({
          ok: true,
          directLineError: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (text && text !== "[mídia]" && text !== "[áudio]") {
      const cleanText = text.trim().toLowerCase();
      const isActivationCommand = ["#ia", "#voltar", "/ia", "/voltar"].includes(cleanText);

      if (isActivationCommand) {
        await supabase
          .from("conversations")
          .update({ botPaused: false, updatedAt: new Date().toISOString() })
          .eq("id", convId)
          .eq("tenantId", tenantId);

        await evoDeleteMessage(tenantId, instanceName, remoteJid, messageId);
      } else {
        await supabase
          .from("conversations")
          .update({ botPaused: true, updatedAt: new Date().toISOString() })
          .eq("id", convId)
          .eq("tenantId", tenantId);
      }
    }
    return Response.json({ ok: true });
  }

  // Automações + Bridge IA: só para mensagens recebidas com texto transcrito/válido
  if (!text || text === "[mídia]" || text === "[áudio]") {
    return Response.json({ ok: true });
  }

  // Interceptar palavras-chave de handoff (como "instalei", "baixei")
  const cleanText = text.trim().toLowerCase();
  const hasHandoffKeyword = cleanText.includes("instalei") || cleanText.includes("baixei");

  if (hasHandoffKeyword) {
    console.log(
      `[webhook] Detectada palavra-chave de handoff ("instalei" ou "baixei"). Pausando bot e transferindo...`,
    );

    // 1. Pausa o bot e atualiza o status para handoff
    await supabase
      .from("conversations")
      .update({
        botPaused: true,
        status: "handoff",
        lastMessage: text.slice(0, 200),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", convId)
      .eq("tenantId", tenantId);

    // 2. Envia a mensagem de transferência padrão (ou aviso de ausência)
    let transferMsg =
      "Perfeito. Vou encaminhar seu atendimento para nossa equipe especializada. Um momento, por favor.";

    // Buscar se o agente tem awayMessage
    const { data: linkedAgent } = await supabase
      .from("agents")
      .select("awayMessage")
      .eq("whatsappInstanceId", instanceName)
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (linkedAgent?.awayMessage) {
      console.log(
        `[webhook] Utilizando aviso de ausência para transferência: "${linkedAgent.awayMessage}"`,
      );
      transferMsg = linkedAgent.awayMessage;
    }
    const number = remoteJid.split("@")[0];
    await evoSendText(tenantId, instanceName, number, transferMsg);

    // 3. Salva a mensagem no banco
    const replyId = `bot_handoff_${Date.now()}`;
    await supabase.from("messages").upsert({
      id: replyId,
      tenantId,
      conversationId: convId,
      text: transferMsg,
      fromMe: true,
      bot: true,
      createdAt: new Date().toISOString(),
    });

    // 4. Atualiza o perfil do cliente e scoring
    updateConversationProfile(tenantId, convId).catch((err) => {
      console.error("[profileUpdate] keyword background error:", err);
    });

    return Response.json({
      ok: true,
      handoffTriggered: true,
      message: "bot-paused-by-handoff-keyword",
    });
  }

  let imageBase64: string | null = null;
  if (isImage) {
    console.log(`[webhook] Detectada imagem recebida. Baixando base64...`);
    imageBase64 = await getEvoMediaBase64(tenantId, instanceName, messageId);
  }

  // Lógica de Triagem Pré-AI
  try {
    const { data: agents } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
    const agent = (agents || []).find((a: any) => a.whatsappInstanceId === instanceName);

    if (
      agent?.triageEnabled === true &&
      agent.triageQuestions &&
      agent.triageQuestions.length > 0
    ) {
      const questions = agent.triageQuestions || [];
      const currentIndex = conv?.triageCurrentIndex || 0;
      const answers = conv?.triageAnswers || {};

      if (currentIndex < questions.length) {
        if (currentIndex > 0) {
          const prevQuestion = questions[currentIndex - 1];
          answers[prevQuestion] = text;
        }

        const nextQuestion = questions[currentIndex];

        // Simular digitação humana
        const number = remoteJid.split("@")[0];
        await evoSendPresence(tenantId, instanceName, number, "composing");
        await new Promise((r) => setTimeout(r, Math.min(2500, nextQuestion.length * 15)));
        await evoSendPresence(tenantId, instanceName, number, "paused");

        await evoSendText(tenantId, instanceName, number, nextQuestion);

        // Atualizar estado no banco de dados
        await supabase
          .from("conversations")
          .update({
            triageAnswers: answers,
            triageCurrentIndex: currentIndex + 1,
            updatedAt: new Date().toISOString(),
            lastMessage: nextQuestion.slice(0, 200),
          })
          .eq("id", convId)
          .eq("tenantId", tenantId);

        // Salvar mensagem da triagem no histórico
        await supabase.from("messages").upsert({
          id: `bot_triage_${Date.now()}`,
          tenantId,
          conversationId: convId,
          text: nextQuestion,
          fromMe: true,
          bot: true,
          createdAt: new Date().toISOString(),
        });

        return Response.json({ ok: true, triageStatus: `question_${currentIndex}` });
      }
    }
  } catch (triageErr) {
    console.error("[triage] erro no processador de triagem:", triageErr);
  }

  try {
    const auto = await runAutomations(tenantId, instanceName, remoteJid, text, convId, conv);
    if (conv?.botPaused === true || auto.pauseBot) {
      console.log(
        `[webhook] Bot PAUSADO para conversa ${convId} (botPaused=${conv?.botPaused}, autoPause=${auto.pauseBot}). Use #ia ou /ia para reativar.`,
      );
      return Response.json({ ok: true, automations: auto, bridge: { skipped: "bot-paused" } });
    }
    console.log(
      `[webhook] Encaminhando para bridge IA: instance=${instanceName}, convId=${convId}, text="${text.slice(0, 50)}..."`,
    );
    const bridge = await runBridge(
      tenantId,
      instanceName,
      remoteJid,
      text,
      convId,
      isAudio,
      imageBase64,
    );
    console.log(`[webhook] Bridge result:`, JSON.stringify(bridge).slice(0, 300));
    return Response.json({ ok: true, automations: auto, bridge });
  } catch (e) {
    console.error("[bridge] erro:", e);
    return Response.json({ ok: true, bridgeError: e instanceof Error ? e.message : String(e) });
  }
}

export const Route = createFileRoute("/api/public/evolution-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Endpoint de diagnóstico — acessível via browser
        const url = new URL(request.url);
        const instanceName = url.searchParams.get("instance");
        const action = url.searchParams.get("action");

        // Ação: despausar bot de todas as conversas de uma instância
        if (action === "unpause" && instanceName) {
          const { data: idx } = await supabase
            .from("instance_index")
            .select("tenantId")
            .eq("instanceName", instanceName)
            .single();
          if (!idx?.tenantId) {
            return Response.json({
              error: `Instância "${instanceName}" não encontrada no instance_index`,
            });
          }
          const { data: updated, error } = await supabase
            .from("conversations")
            .update({ botPaused: false })
            .eq("instanceName", instanceName)
            .eq("tenantId", idx.tenantId)
            .select("id");
          return Response.json({
            ok: true,
            message: `Bot despausado em ${updated?.length || 0} conversas da instância "${instanceName}"`,
            error: error?.message,
          });
        }

        // Diagnóstico geral
        const diagnostics: Record<string, unknown> = { timestamp: new Date().toISOString() };

        // Listar todas as instâncias registradas
        const { data: allInstances } = await supabase
          .from("instance_index")
          .select("instanceName, tenantId");
        diagnostics.registeredInstances = allInstances || [];

        // Listar agentes com whatsappInstanceId
        const { data: allAgents } = await supabase
          .from("agents")
          .select("id, name, whatsappInstanceId, autoReply, providerId, model, status");
        diagnostics.agents = (allAgents || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          whatsappInstanceId: a.whatsappInstanceId,
          autoReply: a.autoReply,
          hasProvider: !!a.providerId,
          hasModel: !!a.model,
          status: a.status,
        }));

        // Conversas pausadas
        const { data: pausedConvs } = await supabase
          .from("conversations")
          .select("id, instanceName, contactName, botPaused, status")
          .eq("botPaused", true)
          .limit(50);
        diagnostics.pausedConversations = pausedConvs || [];

        // Checagem de instância específica
        if (instanceName) {
          const { data: idx } = await supabase
            .from("instance_index")
            .select("tenantId")
            .eq("instanceName", instanceName)
            .single();
          diagnostics.instanceLookup = idx
            ? { found: true, tenantId: idx.tenantId }
            : {
                found: false,
                error: "Instância NÃO registrada no instance_index — webhook será ignorado",
              };

          const linkedAgent = (allAgents || []).find(
            (a: any) => a.whatsappInstanceId === instanceName,
          );
          diagnostics.linkedAgent = linkedAgent
            ? {
                found: true,
                name: linkedAgent.name,
                autoReply: linkedAgent.autoReply,
                hasProvider: !!linkedAgent.providerId,
                hasModel: !!linkedAgent.model,
              }
            : { found: false, error: "Nenhum agente vinculado a esta instância" };
        }

        return Response.json(diagnostics);
      },

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        // Evolution API v2 sends instance as object: { instanceName: "name", ... }
        // Evolution API v1 sends instance as string
        const rawInstance = body?.instance ?? body?.data?.instance;
        const instanceName: string | undefined = ((typeof rawInstance === "object" &&
        rawInstance !== null
          ? (rawInstance.instanceName ?? rawInstance.name)
          : rawInstance) ??
          body?.instanceName ??
          body?.sender) as string | undefined;
        const event: string = ((body?.event ?? body?.type ?? "") as string).toUpperCase();

        console.log(
          `[webhook] ▶ event=${event} instance=${instanceName} rawInstance=${JSON.stringify(rawInstance)}`,
        );

        if (!instanceName) return new Response("missing instance", { status: 200 });

        const { data: idx } = await supabase
          .from("instance_index")
          .select("tenantId")
          .eq("instanceName", instanceName)
          .single();
        const tenantId: string | undefined = idx?.tenantId as string | undefined;
        if (!tenantId) {
          console.warn(
            `[webhook] ❌ instance "${instanceName}" NOT FOUND in instance_index. Verifique se a instância foi registrada corretamente.`,
          );
          return new Response("unknown instance", { status: 200 });
        }

        const { data: tenant } = await supabase
          .from("tenants")
          .select("status, planExpiresAt")
          .eq("id", tenantId)
          .single();

        const isExpired = tenant?.planExpiresAt
          ? new Date() > new Date(tenant.planExpiresAt)
          : false;
        if (tenant?.status === "suspended" || isExpired) {
          console.warn(
            `[webhook] ⛔ tenant "${tenantId}" suspenso ou expirado (status=${tenant?.status}, expires=${tenant?.planExpiresAt}). Ignorando evento ${event}`,
          );
          return Response.json({ ok: false, error: "tenant_suspended_or_expired" });
        }

        console.log(`[webhook] ✓ tenantId=${tenantId} processing ${event} for ${instanceName}`);

        if (event.includes("CONNECTION")) {
          const state = ((body?.data as Record<string, unknown>)?.state ??
            body?.state ??
            "unknown") as string;
          const resolvedStatus = resolveInstanceStatus(state);
          console.log(`[webhook] 🔌 Connection update: ${instanceName} → ${resolvedStatus}`);
          await supabase.from("instances").upsert({
            id: instanceName,
            tenantId,
            name: instanceName,
            status: resolvedStatus,
            updatedAt: new Date().toISOString(),
          });

          // Sincroniza o status dos agentes vinculados a esta instância no banco de dados
          await supabase
            .from("agents")
            .update({ status: resolvedStatus })
            .eq("whatsappInstanceId", instanceName)
            .eq("tenantId", tenantId);

          return Response.json({ ok: true });
        }

        if (event.includes("MESSAGES_UPSERT") || event.includes("MESSAGE")) {
          return handleMessage(tenantId, instanceName, body);
        }

        return Response.json({ ok: true, ignored: event });
      },
    },
  },
});
