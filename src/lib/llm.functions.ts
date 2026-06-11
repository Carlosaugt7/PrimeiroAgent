import { createServerFn } from "@tanstack/react-start";

type Kind = "openai" | "anthropic" | "google" | "groq" | "deepseek" | "openrouter" | "custom";

interface DetectInput {
  kind: Kind;
  baseUrl: string;
  apiKey: string;
}

interface ModelInfo {
  id: string;
  contextWindow?: number;
}

const DEFAULT_BASE: Record<Kind, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

const STATIC_ANTHROPIC: ModelInfo[] = [
  { id: "claude-opus-4-20250514", contextWindow: 200000 },
  { id: "claude-sonnet-4-20250514", contextWindow: 200000 },
  { id: "claude-3-5-sonnet-20241022", contextWindow: 200000 },
  { id: "claude-3-5-haiku-20241022", contextWindow: 200000 },
];

async function fetchOpenAICompatible(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const clean = baseUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(clean)) {
    throw new Error(`Base URL inválida: "${baseUrl}". Use uma URL absoluta começando com https://`);
  }
  const url = `${clean}/models`;
  let r: Response;
  try {
    r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  } catch (e) {
    throw new Error(
      `Falha de rede ao acessar ${url}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} em ${url}: ${body.slice(0, 300)}`);
  }
  const data = (await r.json()) as {
    data?: Array<{ id: string; context_length?: number; context_window?: number }>;
  };
  return (data.data ?? []).map((m) => ({
    id: m.id,
    contextWindow: m.context_length ?? m.context_window,
  }));
}

async function fetchGoogle(apiKey: string): Promise<ModelInfo[]> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => "")}`);
  const data = (await r.json()) as { models?: Array<{ name: string; inputTokenLimit?: number }> };
  return (data.models ?? [])
    .map((m) => ({ id: m.name.replace(/^models\//, ""), contextWindow: m.inputTokenLimit }))
    .filter((m) => /gemini/i.test(m.id));
}

export const detectModels = createServerFn({ method: "POST" })
  .inputValidator((d: DetectInput) => {
    if (!d || typeof d.apiKey !== "string" || d.apiKey.length < 5)
      throw new Error("apiKey ausente");
    if (!d.kind) throw new Error("kind ausente");
    return d;
  })
  .handler(async ({ data }) => {
    const base = data.baseUrl?.trim() || DEFAULT_BASE[data.kind] || "";
    try {
      if (data.kind === "anthropic") return { models: STATIC_ANTHROPIC };
      if (data.kind === "google") return { models: await fetchGoogle(data.apiKey) };
      // OpenAI-compatível: openai, groq, deepseek, openrouter, custom
      const models = await fetchOpenAICompatible(base, data.apiKey);
      return { models };
    } catch (e) {
      return {
        models: [] as ModelInfo[],
        error: e instanceof Error ? e.message : "Falha ao detectar",
      };
    }
  });

interface ChatInput {
  baseUrl: string;
  apiKey: string;
  kind: Kind;
  model: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
}

export const chatCompletion = createServerFn({ method: "POST" })
  .inputValidator((d: ChatInput) => {
    if (!d?.model) throw new Error("model ausente");
    if (!d?.apiKey) throw new Error("apiKey ausente");
    return d;
  })
  .handler(async ({ data }) => {
    const started = Date.now();
    const base = data.baseUrl?.trim() || DEFAULT_BASE[data.kind] || "";

    if (data.kind === "anthropic") {
      const r = await fetch(`${base.replace(/\/$/, "")}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": data.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: data.model,
          system: data.systemPrompt,
          messages: data.messages,
          max_tokens: 1024,
          temperature: data.temperature ?? 0.5,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as {
        content: Array<{ text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };
      return {
        text: j.content?.[0]?.text ?? "",
        inputTokens: j.usage?.input_tokens ?? 0,
        outputTokens: j.usage?.output_tokens ?? 0,
        durationMs: Date.now() - started,
      };
    }

    if (data.kind === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(data.model)}:generateContent?key=${encodeURIComponent(data.apiKey)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: data.systemPrompt }] },
          contents: data.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { temperature: data.temperature ?? 0.5 },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as {
        candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
        usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
      };
      return {
        text: j.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
        inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
        durationMs: Date.now() - started,
      };
    }

    // OpenAI-compatível
    const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.apiKey}` },
      body: JSON.stringify({
        model: data.model,
        messages: [{ role: "system", content: data.systemPrompt }, ...data.messages],
        temperature: data.temperature ?? 0.5,
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    const j = (await r.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      inputTokens: j.usage?.prompt_tokens ?? 0,
      outputTokens: j.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
    };
  });

// ============== Embeddings (OpenAI-compatível) ==============

interface EmbedInput {
  baseUrl: string;
  apiKey: string;
  model: string; // ex: "text-embedding-3-small"
  texts: string[];
}

export const embedTexts = createServerFn({ method: "POST" })
  .inputValidator((d: EmbedInput) => {
    if (!d?.apiKey) throw new Error("apiKey ausente");
    if (!d?.model) throw new Error("model ausente");
    if (!Array.isArray(d.texts) || d.texts.length === 0) throw new Error("texts vazio");
    if (d.texts.length > 100) throw new Error("máximo 100 textos por chamada");
    return d;
  })
  .handler(async ({ data }) => {
    const base = (data.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const r = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.apiKey}` },
        body: JSON.stringify({ model: data.model, input: data.texts }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!r.ok) {
        throw new Error(
          `Embeddings respondeu com HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`,
        );
      }
      const j = (await r.json()) as { data: { embedding: number[] }[] };
      return { vectors: j.data.map((x) => x.embedding) };
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      const msg = e instanceof Error ? e.message : "Falha ao gerar embeddings";
      throw new Error(msg);
    }
  });

interface FetchWebpageInput {
  url: string;
}

export const fetchWebpageText = createServerFn({ method: "POST" })
  .inputValidator((d: FetchWebpageInput) => {
    if (!d?.url) throw new Error("URL ausente");
    if (!/^https?:\/\//i.test(d.url.trim())) {
      throw new Error("A URL deve começar com http:// ou https://");
    }
    return d;
  })
  .handler(async ({ data }) => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const r = await fetch(data.url.trim(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!r.ok) {
        throw new Error(`Servidor respondeu com código de status HTTP ${r.status}`);
      }

      const contentType = r.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        throw new Error("A URL fornecida não aponta para uma página de texto ou HTML legível.");
      }

      const html = await r.text();

      // Limpeza simples e robusta do HTML no servidor
      let text = html.replace(
        /<(script|style|svg|noscript|header|footer|nav)[^>]*>[\s\S]*?<\/\1>/gi,
        "",
      );
      text = text.replace(/<!--[\s\S]*?-->/g, "");
      text = text.replace(/<[^>]+>/g, " ");
      text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      text = text.replace(/\s+/g, " ").trim();

      if (text.length < 20) {
        throw new Error("A página carregada não possui conteúdo de texto legível suficiente.");
      }

      return { text };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao buscar conteúdo da página.";
      throw new Error(msg);
    }
  });
