import { createFileRoute } from "@tanstack/react-router";

const EVO_BASE = "https://evolution-api.rsconsultoria.pro";

async function evoSendText(instanceName: string, number: string, text: string) {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY ausente");
  const r = await fetch(`${EVO_BASE}/message/sendText/${encodeURIComponent(instanceName)}`, {
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
    try { return new RegExp(rule.pattern, cs ? "" : "i").test(text); } catch { return false; }
  }
  // contains (lista separada por vírgula)
  return p.split(",").map((s) => s.trim()).filter(Boolean).some((kw) => t.includes(kw));
}

async function runAutomations(
  fb: typeof import("@/lib/firebase-admin.server"),
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  text: string,
  convPath: string,
  currentConv: Record<string, any> | null,
): Promise<{ pauseBot: boolean; replied: boolean; triggered: string[] }> {
  const rules = (await fb.listCollection(`tenants/${tenantId}/automations`)) as unknown as AutoRule[];
  rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const triggered: string[] = [];
  const updates: Record<string, any> = {};
  const newTags = new Set<string>(Array.isArray(currentConv?.tags) ? currentConv!.tags : []);
  let pauseBot = false;
  let replied = false;
  const number = remoteJid.split("@")[0];

  for (const rule of rules) {
    if (!matches(rule, text)) continue;
    triggered.push(rule.name);
    for (const act of rule.actions ?? []) {
      if (act.type === "addTag" && act.value) newTags.add(act.value.trim());
      else if (act.type === "pauseBot") { pauseBot = true; updates.botPaused = true; }
      else if (act.type === "setStatus" && act.value) updates.status = act.value;
      else if (act.type === "reply" && act.value) {
        try {
          await evoSendText(instanceName, number, act.value);
          const rid = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await fb.setDoc(`${convPath}/messages/${rid}`, {
            id: rid, text: act.value, fromMe: true, createdAt: new Date().toISOString(), automation: rule.name,
          }, { merge: true });
          replied = true;
        } catch (e) {
          console.error("[automation reply] erro:", e);
        }
      }
    }
  }

  if (newTags.size > (Array.isArray(currentConv?.tags) ? currentConv!.tags.length : 0)) {
    updates.tags = [...newTags];
  }
  if (Object.keys(updates).length > 0) {
    await fb.setDoc(convPath, updates, { merge: true });
  }
  return { pauseBot, replied, triggered };
}


function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function embedQuery(provider: any, model: string, text: string): Promise<number[] | null> {
  try {
    const base = (provider.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
    const r = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model, input: [text] }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data: { embedding: number[] }[] };
    return j.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

async function callLLM(provider: any, agent: any, systemPrompt: string, userText: string): Promise<string> {
  const baseUrl = provider.baseUrl?.trim() || "";
  const kind = provider.kind;

  if (kind === "anthropic") {
    const base = (baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, "");
    const r = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: agent.model, system: systemPrompt,
        messages: [{ role: "user", content: userText }],
        max_tokens: 1024, temperature: agent.temperature ?? 0.5,
      }),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { content: Array<{ text: string }> };
    return j.content?.[0]?.text ?? "";
  }

  if (kind === "google") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(agent.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
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
    const j = (await r.json()) as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // OpenAI-compatível
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: agent.model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
      temperature: agent.temperature ?? 0.5,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { choices: Array<{ message: { content: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

async function runBridge(
  fb: typeof import("@/lib/firebase-admin.server"),
  tenantId: string,
  instanceName: string,
  remoteJid: string,
  userText: string,
  convPath: string,
) {
  // 1) Encontrar agente vinculado a esta instância
  const agents = await fb.listCollection(`tenants/${tenantId}/agents`);
  const agent = agents.find((a) => a.whatsappInstanceId === instanceName);
  if (!agent) return { skipped: "no-agent-linked" };
  if (agent.autoReply === false) return { skipped: "auto-reply-off" };
  if (!agent.providerId || !agent.model) return { skipped: "agent-incomplete" };

  // 2) Carregar provider
  const provider = await fb.getDoc(`tenants/${tenantId}/providers/${agent.providerId}`);
  if (!provider?.apiKey) return { skipped: "no-provider" };

  // 3) RAG opcional
  let systemPrompt: string = agent.systemPrompt ?? "Você é um assistente útil.";
  try {
    const docs = await fb.listCollection(`tenants/${tenantId}/knowledge`);
    const compatible = docs.filter((d) => d.embedProviderId === agent.providerId && d.embedModel);
    if (compatible.length > 0) {
      const embedModel = compatible[0].embedModel as string;
      const qvec = await embedQuery(provider, embedModel, userText);
      if (qvec) {
        const scored: Array<{ text: string; score: number }> = [];
        for (const d of compatible.slice(0, 10)) {
          const chunks = await fb.listCollection(`tenants/${tenantId}/knowledge/${d.id}/chunks`, { pageSize: 200 });
          for (const c of chunks) {
            if (Array.isArray(c.embedding) && typeof c.text === "string") {
              scored.push({ text: c.text, score: cosine(qvec, c.embedding as number[]) });
            }
          }
        }
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 4).filter((s) => s.score > 0.2);
        if (top.length > 0) {
          const ctx = top.map((t, i) => `[${i + 1}] ${t.text}`).join("\n\n");
          systemPrompt = `${systemPrompt}\n\n## CONTEXTO RELEVANTE DA BASE DE CONHECIMENTO\nUse APENAS estas informações quando forem pertinentes. Se a resposta não estiver no contexto, diga que vai verificar.\n\n${ctx}`;
        }
      }
    }
  } catch (e) {
    console.warn("[bridge] RAG falhou:", e);
  }

  // 4) Chamar LLM (com log de trace)
  const t0 = Date.now();
  let reply = "";
  let llmError: string | null = null;
  try {
    reply = (await callLLM(provider, agent, systemPrompt, userText)).trim();
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - t0;

  // Log
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await fb.setDoc(`tenants/${tenantId}/ai_logs/${logId}`, {
      id: logId,
      createdAt: new Date().toISOString(),
      agentId: agent.id,
      agentName: agent.name ?? "",
      providerId: agent.providerId,
      providerKind: provider.kind ?? "",
      model: agent.model ?? "",
      instanceName,
      remoteJid,
      conversationId: convPath.split("/").pop(),
      userText: userText.slice(0, 2000),
      reply: reply.slice(0, 4000),
      systemPromptChars: systemPrompt.length,
      latencyMs,
      ok: !llmError && !!reply,
      error: llmError,
    }, { merge: true });
  } catch (e) { console.warn("[ai_logs] falhou:", e); }

  if (llmError) return { error: llmError, latencyMs };
  if (!reply) return { skipped: "empty-reply", latencyMs };

  // 5) Enviar via WhatsApp
  const number = remoteJid.split("@")[0];
  await evoSendText(instanceName, number, reply);

  // 6) Registrar resposta do bot no Firestore
  const replyId = `bot_${Date.now()}`;
  await fb.setDoc(`${convPath}/messages/${replyId}`, {
    id: replyId, text: reply, fromMe: true, bot: true, agentId: agent.id, createdAt: new Date().toISOString(),
  }, { merge: true });
  await fb.setDoc(convPath, {
    lastMessage: reply.slice(0, 200), updatedAt: new Date().toISOString(),
  }, { merge: true });

  return { ok: true, agent: agent.id, latencyMs };
}

export const Route = createFileRoute("/api/public/evolution-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return new Response("invalid json", { status: 400 }); }

        const instanceName: string | undefined =
          body?.instance ?? body?.instanceName ?? body?.data?.instance ?? body?.sender;
        const event: string = (body?.event ?? body?.type ?? "").toString().toUpperCase();

        if (!instanceName) return new Response("missing instance", { status: 200 });

        const fb = await import("@/lib/firebase-admin.server");

        const idx = await fb.getDoc(`instance_index/${instanceName}`);
        const tenantId: string | undefined = idx?.tenantId;
        if (!tenantId) return new Response("unknown instance", { status: 200 });

        if (event.includes("CONNECTION")) {
          const state = body?.data?.state ?? body?.state ?? "unknown";
          await fb.setDoc(`tenants/${tenantId}/instances/${instanceName}`, {
            name: instanceName,
            status: state === "open" ? "online" : state === "connecting" ? "conectando" : "offline",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          return Response.json({ ok: true });
        }

        if (event.includes("MESSAGES_UPSERT") || event.includes("MESSAGE")) {
          const m = body?.data ?? body?.message ?? body;
          const key = m?.key ?? {};
          const remoteJid: string | undefined = key.remoteJid ?? m?.remoteJid;
          if (!remoteJid) return new Response("no remoteJid", { status: 200 });
          if (remoteJid.endsWith("@g.us")) return Response.json({ ok: true, ignored: "group" });

          const fromMe: boolean = !!key.fromMe;
          const messageId: string = key.id ?? `${Date.now()}`;
          const text: string =
            m?.message?.conversation ??
            m?.message?.extendedTextMessage?.text ??
            m?.text ??
            "[mídia]";
          const pushName: string = m?.pushName ?? remoteJid.split("@")[0];
          const convId = remoteJid.replace(/[^a-zA-Z0-9_-]/g, "_");
          const convPath = `tenants/${tenantId}/conversations/${convId}`;

          await fb.setDoc(convPath, {
            id: convId,
            instanceName,
            contactName: pushName,
            contactPhone: remoteJid.split("@")[0],
            remoteJid,
            lastMessage: text.slice(0, 200),
            updatedAt: new Date().toISOString(),
            status: "aberta",
            ...(fromMe ? { unread: 0 } : { unread: fb.FieldValue.increment(1) }),
          }, { merge: true });

          await fb.setDoc(`${convPath}/messages/${messageId}`, {
            id: messageId, text, fromMe, createdAt: new Date().toISOString(),
          }, { merge: true });

          // Automações + Bridge IA: só para mensagens recebidas com texto
          if (!fromMe && text && text !== "[mídia]") {
            try {
              const conv = await fb.getDoc(convPath);
              const auto = await runAutomations(fb, tenantId, instanceName, remoteJid, text, convPath, conv);

              if (conv?.botPaused === true || auto.pauseBot) {
                return Response.json({ ok: true, automations: auto, bridge: { skipped: "bot-paused" } });
              }
              const r = await runBridge(fb, tenantId, instanceName, remoteJid, text, convPath);
              return Response.json({ ok: true, automations: auto, bridge: r });
            } catch (e) {
              console.error("[bridge] erro:", e);
              return Response.json({ ok: true, bridgeError: e instanceof Error ? e.message : String(e) });
            }
          }

          return Response.json({ ok: true });
        }

        return Response.json({ ok: true, ignored: event });
      },
    },
  },
});
