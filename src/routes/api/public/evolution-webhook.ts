import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const EVO_BASE_FALLBACK = "https://evolution-api.rsconsultoria.pro";

async function evoSendText(tenantId: string, instanceName: string, number: string, text: string) {
  let url = EVO_BASE_FALLBACK;
  let key = process.env.EVOLUTION_API_KEY;

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

  if (!key) throw new Error("EVOLUTION_API_KEY ausente ou não configurada");
  const r = await fetch(`${url}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) throw new Error(`sendText ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
  providerId: string,
  provider: Record<string, unknown>,
  userText: string,
): Promise<string | null> {
  const { data: docs } = await supabase.from("knowledge").select("*").eq("tenantId", tenantId);
  if (!docs) return null;

  const compatible = docs.filter((d: any) => d.embedProviderId === providerId && d.embedModel);
  if (compatible.length === 0) return null;

  const embedModel = compatible[0].embedModel as string;
  const qvec = await embedQuery(provider, embedModel, userText);
  if (!qvec) return null;

  const scored: Array<{ text: string; score: number }> = [];
  for (const d of compatible.slice(0, 10)) {
    const { data: chunks } = await supabase
      .from("knowledge_chunks")
      .select("*")
      .eq("knowledgeId", d.id)
      .limit(200);
    if (!chunks) continue;
    for (const c of chunks) {
      if (Array.isArray(c.embedding) && typeof c.text === "string") {
        scored.push({ text: c.text, score: cosine(qvec, c.embedding as number[]) });
      }
    }
  }
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
}

async function callOpenAICompat(
  provider: Record<string, unknown>,
  agent: Record<string, unknown>,
  systemPrompt: string,
  userText: string,
): Promise<string> {
  const baseUrl = (provider.baseUrl as string)?.trim() || "";
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
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
    const ragCtx = await buildRagContext(tenantId, agent.providerId, provider, userText);
    if (ragCtx) {
      systemPrompt = `${systemPrompt}\n\n## CONTEXTO RELEVANTE DA BASE DE CONHECIMENTO\nUse APENAS estas informações quando forem pertinentes. Se a resposta não estiver no contexto, diga que vai verificar.\n\n${ragCtx}`;
    }
  } catch (e) {
    console.warn("[bridge] RAG falhou:", e);
  }

  // 4) Chamar LLM com instruções de Agendamento Clínico acopladas no prompt
  const systemPromptComAgendamento = `${systemPrompt}\n\n` +
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

  // 6) Enviar via WhatsApp
  const number = remoteJid.split("@")[0];
  await evoSendText(tenantId, instanceName, number, reply);

  // 7) Registrar resposta do bot no Supabase
  const replyId = `bot_${Date.now()}`;
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

  await supabase
    .from("conversations")
    .update({
      lastMessage: reply.slice(0, 200),
      updatedAt: new Date().toISOString(),
    })
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
  const text: string =
    (msgData?.conversation as string) ??
    ((msgData?.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    (m?.text as string) ??
    "[mídia]";
  const pushName: string = (m?.pushName as string) ?? remoteJid.split("@")[0];
  const convId = remoteJid.replace(/[^a-zA-Z0-9_-]/g, "_");

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

  // Automações + Bridge IA: só para mensagens recebidas com texto
  if (fromMe || !text || text === "[mídia]") {
    return Response.json({ ok: true });
  }

  try {
    const auto = await runAutomations(tenantId, instanceName, remoteJid, text, convId, conv);
    if (conv?.botPaused === true || auto.pauseBot) {
      return Response.json({ ok: true, automations: auto, bridge: { skipped: "bot-paused" } });
    }
    const bridge = await runBridge(tenantId, instanceName, remoteJid, text, convId);
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

        const instanceName: string | undefined = (body?.instance ??
          body?.instanceName ??
          body?.data?.instance ??
          body?.sender) as string | undefined;
        const event: string = ((body?.event ?? body?.type ?? "") as string).toUpperCase();

        if (!instanceName) return new Response("missing instance", { status: 200 });

        const { data: idx } = await supabase
          .from("instance_index")
          .select("tenantId")
          .eq("instanceName", instanceName)
          .single();
        const tenantId: string | undefined = idx?.tenantId as string | undefined;
        if (!tenantId) return new Response("unknown instance", { status: 200 });

        if (event.includes("CONNECTION")) {
          const state = ((body?.data as Record<string, unknown>)?.state ??
            body?.state ??
            "unknown") as string;
          await supabase.from("instances").upsert({
            id: instanceName,
            tenantId,
            name: instanceName,
            status: resolveInstanceStatus(state),
            updatedAt: new Date().toISOString(),
          });
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
