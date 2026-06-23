import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";

const EVO_BASE_FALLBACK = "https://evolution-api.rsconsultoria.pro";

// Busca config global da tabela global_settings
async function getGlobalEvoConfig(): Promise<{ url: string; key: string | undefined }> {
  try {
    const { data } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["evolutionApiUrl", "evolutionApiKey"]);

    if (data && data.length > 0) {
      const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
      const u = map.evolutionApiUrl?.trim();
      const k = map.evolutionApiKey?.trim();
      if (u && k) return { url: u.replace(/\/$/, ""), key: k };
    }
  } catch { /* usa fallback */ }
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

    const r = await fetch(`${cfg.url}/chat/getBase64FromMedia/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId
          }
        },
        convertToMp3: true
      }),
    });
    if (!r.ok) {
      console.warn(`[evoGetBase64Media] falhou: ${r.status}`);
      return null;
    }
    const res = await r.json() as { base64?: string };
    return res.base64 ?? null;
  } catch (e) {
    console.error("[evoGetBase64Media] erro:", e);
    return null;
  }
}

async function transcribeAudioWithOpenAI(apiKey: string, base64Data: string): Promise<string | null> {
  try {
    const base64Clean = base64Data.includes("base64,") ? base64Data.split("base64,")[1] : base64Data;
    const buffer = Buffer.from(base64Clean, "base64");
    
    const blob = new Blob([buffer], { type: "audio/mp3" });
    const formData = new FormData();
    formData.append("file", blob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!r.ok) {
      console.warn(`[Whisper] erro: ${r.status} - ${await r.text()}`);
      return null;
    }

    const j = await r.json() as { text: string };
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
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
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
    });

    if (!response.ok) {
      console.error(`[ElevenLabs] Erro ao gerar áudio: ${response.status} - ${await response.text()}`);
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
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("[ElevenLabs] Erro na síntese/upload:", e);
    return null;
  }
}

async function evoSendAudio(tenantId: string, instanceName: string, number: string, audioUrl: string) {
  const cfg = await getEvoConfig(tenantId);
  if (!cfg.key) throw new Error("EVOLUTION_API_KEY ausente ou não configurada");

  const r = await fetch(`${cfg.url}/message/sendAudio/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ number, audio: audioUrl }),
  });
  if (!r.ok) throw new Error(`sendAudio ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
          content: { parts: [{ text }] }
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

async function buildRagContext(
  tenantId: string,
  userText: string,
): Promise<string | null> {
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

const WORK_HOURS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

async function getAvailableSlots(tenantId: string, specialty: string, date: string): Promise<string[]> {
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
    try { return await fn(); } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isTransient = /503|502|429|UNAVAILABLE|high demand|overloaded|rate.?limit/i.test(msg);
      if (!isTransient || attempt === maxAttempts) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

async function callAnthropic(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const baseUrl = (provider.baseUrl as string)?.trim() || "";
  const base = (baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, "");
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
      messages: [{ role: "user", content: userText }],
      max_tokens: 1024,
      temperature: agent.temperature ?? 0.5,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { content: Array<{ text: string }> };
  return j.content?.[0]?.text ?? "";
}

async function callGoogle(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(agent.model as string)}:generateContent?key=${encodeURIComponent(provider.apiKey as string)}`;
  return withRetry(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: agent.temperature ?? 0.5 },
      }),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  });
}

async function callOpenAICompat(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const baseUrl = (provider.baseUrl as string)?.trim() || "";
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return withRetry(async () => {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: agent.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        temperature: agent.temperature ?? 0.5,
      }),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { choices: Array<{ message: { content: string } }> };
    return j.choices?.[0]?.message?.content ?? "";
  });
}

async function callLLM(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const kind = provider.kind;
  if (kind === "anthropic") return callAnthropic(provider, agent, systemPrompt, userText);
  if (kind === "google") return callGoogle(provider, agent, systemPrompt, userText);
  return callOpenAICompat(provider, agent, systemPrompt, userText);
}

// ===== Bridge principal =====

async function runBridge(
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  userText: string,
  convId: string,
  isAudioInput = false,
) {
  // 1) Encontrar agente vinculado a esta instância
  const { data: agents } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
  const agent = (agents || []).find((a: any) => a.whatsappInstanceId === instanceName);
  if (!agent) return { skipped: "no-agent-linked" };
  if (agent.autoReply === false) return { skipped: "auto-reply-off" };
  if (!agent.providerId || !agent.model) return { skipped: "agent-incomplete" };

  // 2) Carregar provider
  const { data: provider } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("id", agent.providerId)
    .eq("tenantId", tenantId)
    .single();
  if (!provider?.apiKey) return { skipped: "no-provider" };

  // 3) RAG opcional
  let systemPrompt: string = (agent.systemPrompt as string) ?? "Você é um assistente útil.";
  try {
    const ragCtx = await buildRagContext(tenantId, userText);
    if (ragCtx) {
      systemPrompt = `${systemPrompt}\n\n## BASE DE CONHECIMENTO — FONTE ÚNICA DE VERDADE\n` +
        `Abaixo estão as únicas informações que você deve usar para responder o usuário.\n` +
        `REGRAS OBRIGATÓRIAS:\n` +
        `1. Responda SOMENTE com base nas informações abaixo. Nunca invente, suponha ou complemente com conhecimento externo.\n` +
        `2. Se a pergunta do usuário não for respondível com as informações abaixo, diga exatamente: "Vou verificar isso para você agora."\n` +
        `3. Não mencione que está consultando uma base de conhecimento ou documentos.\n` +
        `4. Não crie listas de itens, preços, planos ou funcionalidades que não estejam explicitamente descritos abaixo.\n\n${ragCtx}`;
    } else {
      systemPrompt = `${systemPrompt}\n\n## DIRETRIZ DE CONHECIMENTO LIMITADO\n` +
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
      historyContext = `## HISTÓRICO RECENTE DA CONVERSA\n` +
        `Use o histórico abaixo para saber o que já foi conversado, evitar repetir as mesmas perguntas ou saudações e manter a fluidez:\n\n` +
        formattedLines.join("\n") + "\n\n";
    }
  } catch (e) {
    console.warn("[bridge] falhou ao carregar histórico:", e);
  }

  // 4) Chamar LLM com instruções de Agendamento Clínico acopladas no prompt
  const systemPromptComAgendamento = `${systemPrompt}\n\n` +
    (historyContext ? `${historyContext}` : "") +
    `## AGENDAMENTO INTELIGENTE (SUPERPODERES)\n` +
    `Você é integrado em tempo real ao banco de dados da clínica. Sempre que precisar consultar vagas, criar ou cancelar agendamentos, emita a tag correspondente EXATAMENTE no final da sua resposta, e o sistema executará a ação:\n` +
    `1. Consultar horários livres para uma especialidade e data:\n` +
    `   [ACTION: check_availability { "specialty": "especialidade", "date": "AAAA-MM-DD" }]\n` +
    `2. Confirmar consulta (pergunte o nome do paciente antes!):\n` +
    `   [ACTION: book_appointment { "patientName": "Nome do Paciente", "specialty": "especialidade", "date": "AAAA-MM-DD", "time": "HH:MM" }]\n` +
    `3. Cancelar a consulta ativa do paciente atual (libera a vaga no banco):\n` +
    `   [ACTION: cancel_appointment {}]\n\n` +
    `Nota: Emita apenas UMA tag por resposta. O usuário não verá essas tags [ACTION:].`;

  const t0 = Date.now();
  let reply = "";
  let llmError: string | null = null;
  try {
    reply = (await callLLM(provider, agent, systemPromptComAgendamento, userText)).trim();
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
          const ok = await createAppointment(tenantId, args.patientName, number, args.specialty, args.date, args.time);
          if (ok) {
            actionResult = `Agendamento criado com sucesso para ${args.patientName} em ${args.date} às ${args.time} para a especialidade ${args.specialty}.`;
          } else {
            actionResult = `Falha ao criar agendamento no banco de dados.`;
          }
        } else if (actionType === "cancel_appointment") {
          const number = remoteJid.split("@")[0];
          actionResult = await cancelAppointment(tenantId, number);
        } else {
          actionResult = `Ação desconhecida: ${actionType}`;
        }
      } catch (err: unknown) {
        actionResult = `Erro ao processar argumentos da ação: ${err instanceof Error ? err.message : String(err)}`;
      }

      // Segunda chamada do LLM com o resultado para gerar a resposta conversacional final
      const feedbackSystemPrompt = `${systemPrompt}\n\n` +
        `## RESULTADO DA AÇÃO EXECUTADA NO BANCO\n` +
        `Você acionou a ação '${actionType}' e o sistema retornou:\n` +
        `"${actionResult}"\n\n` +
        `Agora, formule uma resposta amigável e simpática em português para o paciente informando o resultado. Não emita nenhuma tag [ACTION:] nesta resposta final.`;

      try {
        reply = (await callLLM(provider, agent, feedbackSystemPrompt, `Resultado do sistema: ${actionResult}`)).trim();
      } catch (e) {
        llmError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  // Remove qualquer tag ACTION remanescente na resposta por segurança
  reply = reply.replace(/\[ACTION:.*?\]/g, "").trim();

  const latencyMs = Date.now() - t0;

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
    console.log(`[bridge] Gerando resposta de voz via ElevenLabs para voiceId=${agent.elevenlabsVoiceId}`);
    try {
      const audioUrl = await generateElevenLabsAudio(
        tenantId,
        tenant.elevenlabsApiKey,
        agent.elevenlabsVoiceId,
        reply
      );
      if (audioUrl) {
        sentAudioUrl = audioUrl;
        console.log(`[bridge] Áudio gerado: ${audioUrl}. Enviando ao WhatsApp...`);
        await evoSendAudio(tenantId, instanceName, number, audioUrl);
      } else {
        console.warn("[bridge] Falha na geração do áudio. Usando texto de fallback.");
        await evoSendText(tenantId, instanceName, number, reply);
      }
    } catch (e) {
      console.error("[bridge] Erro ao enviar áudio. Usando texto de fallback:", e);
      await evoSendText(tenantId, instanceName, number, reply);
    }
  } else {
    await evoSendText(tenantId, instanceName, number, reply);
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

  // Verifica se a resposta da IA indica transferência para suporte especializado
  const isHandoff = /encaminhar seu atendimento|equipe especializada|suporte especializado/i.test(reply);

  const convUpdatePayload: Record<string, any> = {
    lastMessage: reply.slice(0, 200),
    updatedAt: new Date().toISOString(),
  };

  if (isHandoff) {
    console.log(`[bridge] Resposta da IA contêm gatilho de handoff. Pausando bot para a conversa ${convId}.`);
    convUpdatePayload.botPaused = true;
    convUpdatePayload.status = "handoff";
  }

  await supabase
    .from("conversations")
    .update(convUpdatePayload)
    .eq("id", convId)
    .eq("tenantId", tenantId);

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
  const messageId: string = (key.id as string) ?? `${Date.now()}`;
  const msgData = m?.message as Record<string, unknown> | undefined;
  const isAudio = !!msgData?.audioMessage;
  let text: string =
    (msgData?.conversation as string) ??
    ((msgData?.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    (m?.text as string) ??
    (isAudio ? "[áudio]" : "[mídia]");
  const pushName: string = (m?.pushName as string) ?? remoteJid.split("@")[0];
  const convId = remoteJid.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Transcrição de áudio recebido do cliente
  if (isAudio && !fromMe) {
    console.log(`[webhook] Detectado áudio recebido. Tentando obter transcrição...`);
    // 1. Tentar pegar transcrição nativa da Evolution API se estiver disponível
    let audioText = (msgData?.audioMessage as any)?.text || (m as any)?.text;
    if (audioText && audioText !== "[áudio]" && audioText !== "[mídia]") {
      text = audioText;
      console.log(`[webhook] Transcrição nativa da Evolution API obtida: "${text}"`);
    } else {
      // 2. Transcrição ativa baixando mídia e enviando ao Whisper
      try {
        const base64Audio = await evoGetBase64Media(tenantId, instanceName, messageId);
        if (base64Audio) {
          const { data: agents } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
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

  // Lógica de controle do Bot via WhatsApp (atendente interage pelo celular)
  if (fromMe) {
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
    console.log(`[webhook] Detectada palavra-chave de handoff ("instalei" ou "baixei"). Pausando bot e transferindo...`);

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

    // 2. Envia a mensagem de transferência padrão
    const transferMsg = "Perfeito. Vou encaminhar seu atendimento para nossa equipe especializada. Um momento, por favor.";
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

    return Response.json({
      ok: true,
      handoffTriggered: true,
      message: "bot-paused-by-handoff-keyword",
    });
  }

  try {
    const auto = await runAutomations(tenantId, instanceName, remoteJid, text, convId, conv);
    if (conv?.botPaused === true || auto.pauseBot) {
      return Response.json({ ok: true, automations: auto, bridge: { skipped: "bot-paused" } });
    }
    const bridge = await runBridge(tenantId, instanceName, remoteJid, text, convId, isAudio);
    return Response.json({ ok: true, automations: auto, bridge });
  } catch (e) {
    console.error("[bridge] erro:", e);
    return Response.json({ ok: true, bridgeError: e instanceof Error ? e.message : String(e) });
  }
}

export const Route = createFileRoute("/api/public/evolution-webhook")({
  server: {
    handlers: {
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
        const instanceName: string | undefined = (
          (typeof rawInstance === "object" && rawInstance !== null
            ? rawInstance.instanceName ?? rawInstance.name
            : rawInstance) ??
          body?.instanceName ??
          body?.sender
        ) as string | undefined;
        const event: string = ((body?.event ?? body?.type ?? "") as string).toUpperCase();

        console.log(`[webhook] event=${event} instance=${instanceName} rawInstance=${JSON.stringify(rawInstance)}`);

        if (!instanceName) return new Response("missing instance", { status: 200 });

        const { data: idx } = await supabase
          .from("instance_index")
          .select("tenantId")
          .eq("instanceName", instanceName)
          .single();
        const tenantId: string | undefined = idx?.tenantId as string | undefined;
        if (!tenantId) {
          console.warn(`[webhook] instance "${instanceName}" not found in instance_index`);
          return new Response("unknown instance", { status: 200 });
        }

        const { data: tenant } = await supabase
          .from("tenants")
          .select("status, planExpiresAt")
          .eq("id", tenantId)
          .single();

        const isExpired = tenant?.planExpiresAt ? new Date() > new Date(tenant.planExpiresAt) : false;
        if (tenant?.status === "suspended" || isExpired) {
          console.warn(`[webhook] tenant "${tenantId}" suspenso ou expirado (status=${tenant?.status}, expires=${tenant?.planExpiresAt}). Ignorando evento ${event}`);
          return Response.json({ ok: false, error: "tenant_suspended_or_expired" });
        }

        console.log(`[webhook] tenantId=${tenantId} processing ${event} for ${instanceName}`);

        if (event.includes("CONNECTION")) {
          const state = ((body?.data as Record<string, unknown>)?.state ??
            body?.state ??
            "unknown") as string;
          const resolvedStatus = resolveInstanceStatus(state);
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
