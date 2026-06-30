import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/app-store";
import { chatCompletion, embedTexts } from "@/lib/llm.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Database,
  Pencil,
  Check,
  X,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/playground")({ component: PlaygroundPage });

interface Msg {
  role: "user" | "assistant";
  content: string;
}
interface KnowMeta {
  id: string;
  name: string;
  embedProviderId: string;
  embedModel: string;
  vectorDim: number;
}
interface Chunk {
  docId: string;
  docName: string;
  embedProviderId?: string;
  embedModel?: string;
  id: string;
  text: string;
  embedding: number[];
}

const scenarios = [
  { name: "Cliente curioso", text: "Oi, quanto custa esse serviço?" },
  { name: "Objeção preço", text: "Achei caro, vocês fazem desconto?" },
  { name: "Suporte", text: "Meu pedido não chegou ainda, o que faço?" },
  { name: "Quer humano", text: "Quero falar com um atendente real" },
];

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function chunkText(text: string, chunkSize = 800, overlap = 120): string[] {
  const clean = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= chunkSize) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + chunkSize, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const cut = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
      );
      if (cut > chunkSize * 0.5) end = i + cut + 1;
    }
    out.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = end - overlap;
    if (i <= 0) break;
  }
  return out.filter(Boolean);
}

function PlaygroundPage() {
  const { tenant } = useAuth();
  const { agents, providers } = useAppStore();
  const chat = useServerFn(chatCompletion);
  const embed = useServerFn(embedTexts);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [agentId, setAgentId] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{
    tokensIn: number;
    tokensOut: number;
    ms: number;
    ragUsed: number;
  } | null>(null);

  const [useRag, setUseRag] = useState(true);
  const [topK, setTopK] = useState(3);
  const [knowDocs, setKnowDocs] = useState<KnowMeta[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  // Rola automaticamente para o final da conversa quando novas mensagens chegam ou quando o agente está digitando
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [msgs, busy]);

  const agent = agents.find((a) => a.id === agentId);
  const provider = providers.find((p) => p.id === agent?.providerId);

  // Estados para edição de resposta e modal de FAQ
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const [faqOpen, setFaqOpen] = useState(false);
  const [faqTitle, setFaqTitle] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqProviderId, setFaqProviderId] = useState("");
  const [faqEmbedModel, setFaqEmbedModel] = useState("gemini-embedding-2");
  const [faqIngesting, setFaqIngesting] = useState(false);

  const EMBED_CAPABLE_KINDS = ["openai", "openrouter", "google", "custom"];
  const embedProviders = useMemo(() => {
    return providers.filter((p) => EMBED_CAPABLE_KINDS.includes(p.kind));
  }, [providers]);

  const saveFaq = async () => {
    if (!tenant) return;
    const prov = providers.find((p) => p.id === faqProviderId);
    if (!prov) {
      toast.error("Selecione um provedor de embeddings");
      return;
    }
    if (!faqTitle.trim()) {
      toast.error("Título da FAQ é obrigatório");
      return;
    }
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast.error("Pergunta e resposta são obrigatórias");
      return;
    }

    setFaqIngesting(true);
    const docId = generateId();
    try {
      const docText = `Pergunta: ${faqQuestion.trim()}\nResposta: ${faqAnswer.trim()}`;
      const textChunks = chunkText(docText);

      // Obter embeddings
      const vectors: number[][] = [];
      const BATCH = 64;
      for (let i = 0; i < textChunks.length; i += BATCH) {
        const slice = textChunks.slice(i, i + BATCH);
        const r = await embed({
          data: {
            kind: prov.kind,
            baseUrl: prov.baseUrl,
            apiKey: prov.apiKey,
            model: faqEmbedModel,
            texts: slice,
          },
        });
        vectors.push(...r.vectors);
      }

      // Salvar no banco
      const { error: docErr } = await supabase.from("knowledge").insert({
        id: docId,
        tenantId: tenant.id,
        name: faqTitle.trim(),
        embedModel: faqEmbedModel,
        embedProviderId: faqProviderId,
        createdAt: new Date().toISOString(),
      });
      if (docErr) throw docErr;

      const chunkInserts = textChunks.map((c, idx) => ({
        id: `${docId}_${String(idx).padStart(5, "0")}`,
        knowledgeId: docId,
        text: c,
        embedding: vectors[idx],
      }));

      // Ingest em lotes de 200
      for (let i = 0; i < chunkInserts.length; i += 200) {
        const slice = chunkInserts.slice(i, i + 200);
        const { error: chunkErr } = await supabase.from("knowledge_chunks").insert(slice);
        if (chunkErr) throw chunkErr;
      }

      toast.success(`"${faqTitle}" salvo como FAQ e indexado!`);
      setFaqOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na ingestão";
      toast.error(msg);
    } finally {
      setFaqIngesting(false);
    }
  };

  // Lista docs do tenant filtrando por agente selecionado
  useEffect(() => {
    if (!tenant) return;

    const fetchKnowledge = async () => {
      try {
        let query = supabase.from("knowledge").select("*").eq("tenantId", tenant.id);

        if (agentId) {
          query = query.or(`agentId.eq.${agentId},agentId.is.null`);
        }

        const { data, error } = await query;
        if (error) {
          // Fallback caso a coluna agentId nao exista no banco de dados ainda
          const fallbackQuery = await supabase
            .from("knowledge")
            .select("*")
            .eq("tenantId", tenant.id);
          if (fallbackQuery.data) setKnowDocs(fallbackQuery.data as any[]);
        } else if (data) {
          setKnowDocs(data as any[]);
        }
      } catch (err) {
        console.warn("[playground] erro ao carregar docs:", err);
      }
    };

    fetchKnowledge();

    const channel = supabase
      .channel("public:knowledge")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "knowledge",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchKnowledge,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant, agentId]);

  // Carrega todos os chunks dos docs do tenant
  useEffect(() => {
    if (!tenant || knowDocs.length === 0) {
      setChunks([]);
      return;
    }
    let cancelled = false;

    (async () => {
      setChunksLoading(true);
      try {
        const docIds = knowDocs.map((d) => d.id);
        const { data, error } = await supabase
          .from("knowledge_chunks")
          .select("*, knowledge:knowledgeId(name, embedProviderId, embedModel)")
          .in("knowledgeId", docIds);

        if (error) throw error;

        const all: Chunk[] = (data || []).map((c: any) => {
          // Parse string vector format '[0.1, 0.2, ...]' to array of numbers
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

          return {
            docId: c.knowledgeId,
            docName: c.knowledge?.name || "Documento",
            embedProviderId: c.knowledge?.embedProviderId,
            embedModel: c.knowledge?.embedModel,
            id: c.id,
            text: c.text,
            embedding: embeddingArray,
          };
        });

        if (!cancelled) setChunks(all);
      } catch (err) {
        console.warn("[playground] chunks load failed:", err);
      } finally {
        if (!cancelled) setChunksLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenant, knowDocs]);

  const ragInfo = useMemo(() => {
    return { docCount: knowDocs.length, chunkCount: chunks.length };
  }, [knowDocs, chunks]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !agent || !provider) {
      if (!agent) toast.error("Selecione um agente");
      else if (!provider) toast.error("Agente sem provedor LLM configurado");
      return;
    }
    const newMsgs: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(newMsgs);
    setInput("");
    setBusy(true);

    try {
      // RAG: busca top-K chunks relevantes
      let systemPrompt = agent.systemPrompt;
      let ragUsed = 0;
      if (useRag && chunks.length > 0) {
        try {
          // Agrupa chunks por embedProviderId + embedModel
          const groups: Record<string, { providerId: string; model: string; chunks: Chunk[] }> = {};
          for (const c of chunks) {
            if (!c.embedProviderId || !c.embedModel) continue;
            const key = `${c.embedProviderId}:::${c.embedModel}`;
            if (!groups[key]) {
              groups[key] = { providerId: c.embedProviderId, model: c.embedModel, chunks: [] };
            }
            groups[key].chunks.push(c);
          }

          const scored: Array<{ c: Chunk; s: number }> = [];

          for (const key of Object.keys(groups)) {
            const group = groups[key];
            const p = providers.find((prov) => prov.id === group.providerId);
            if (!p) continue;

            const q = await embed({
              data: {
                kind: p.kind as any,
                baseUrl: p.baseUrl || "",
                apiKey: p.apiKey || "",
                model: group.model,
                texts: [content],
              },
            });
            const qv = q.vectors[0];
            for (const c of group.chunks) {
              scored.push({ c, s: cosine(qv, c.embedding) });
            }
          }

          if (scored.length > 0) {
            const topChunks = scored
              .sort((a, b) => b.s - a.s)
              .slice(0, topK)
              .filter((x) => x.s > 0.35);

            if (topChunks.length) {
              const context = topChunks
                .map((x, i) => `[${i + 1}] (${x.c.docName})\n${x.c.text}`)
                .join("\n\n---\n\n");
              systemPrompt = `${agent.systemPrompt}\n\n## BASE DE CONHECIMENTO — FONTE ÚNICA DE VERDADE\nAbaixo estão as únicas informações que você deve usar para responder o usuário.\nREGRAS OBRIGATÓRIAS:\n1. Responda SOMENTE com base nas informações abaixo. Nunca invente, suponha ou complemente com conhecimento externo.\n2. Se a pergunta não for respondível com as informações abaixo, diga: "Vou verificar isso para você agora."\n3. Não crie listas de itens, preços ou funcionalidades que não estejam explicitamente descritos abaixo.\n\n${context}`;
              ragUsed = topChunks.length;
            }
          }
        } catch (e) {
          console.warn("[rag] embed query falhou:", e);
        }
      }

      // Outros provedores: chamada via server function
      const r = await chat({
        data: {
          kind: provider.kind,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: agent.model,
          systemPrompt,
          messages: newMsgs,
          temperature: useRag ? 0.1 : agent.temperature,
        },
      });
      setMsgs([...newMsgs, { role: "assistant", content: r.text }]);
      setStats({ tokensIn: r.inputTokens, tokensOut: r.outputTokens, ms: r.durationMs, ragUsed });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro na chamada LLM");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Playground</h1>
        <p className="text-muted-foreground mt-1">Teste seus agentes com RAG ativo.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-2xl bg-gradient-card border border-border flex flex-col h-[70vh]">
          <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
            <Select
              value={agentId}
              onValueChange={(v) => {
                setAgentId(v);
                setMsgs([]);
                setStats(null);
              }}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecione um agente..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{" "}
                    <span className="text-muted-foreground">· {a.model || "sem modelo"}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMsgs([]);
                setStats(null);
              }}
            >
              <Trash2 className="size-4" /> Limpar
            </Button>
          </div>

          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.length === 0 && (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <Sparkles className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Selecione um agente e envie uma mensagem.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {scenarios.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => send(s.text)}
                        disabled={!agent}
                        className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "user" ? (
                  <div className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap bg-gradient-primary text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div className="group flex flex-col gap-1 max-w-[75%]">
                    <div className="bg-secondary rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2 px-2 mt-0.5">
                      <button
                        onClick={() => {
                          setEditingIdx(i);
                          setEditContent(m.content);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <Pencil className="size-3" /> Editar
                      </button>
                      <button
                        onClick={() => {
                          const prevUserMsg =
                            i > 0 && msgs[i - 1].role === "user" ? msgs[i - 1].content : "";
                          setFaqQuestion(prevUserMsg);
                          setFaqAnswer(m.content);
                          setFaqTitle(
                            prevUserMsg ? `FAQ: ${prevUserMsg.slice(0, 35)}...` : "FAQ do Agente",
                          );
                          if (embedProviders.length > 0) {
                            const first = embedProviders[0];
                            setFaqProviderId(first.id);
                            if (first.kind === "google") {
                              setFaqEmbedModel("gemini-embedding-2");
                            } else if (first.kind === "openrouter") {
                              setFaqEmbedModel("openai/text-embedding-3-small");
                            } else {
                              setFaqEmbedModel("text-embedding-3-small");
                            }
                          } else {
                            setFaqProviderId("");
                            setFaqEmbedModel("text-embedding-3-small");
                          }
                          setFaqOpen(true);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <Bookmark className="size-3" /> Salvar FAQ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl px-4 py-2.5">
                  <Loader2 className="animate-spin size-4" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Digite a mensagem do cliente..."
              disabled={busy}
            />
            <Button variant="hero" onClick={() => send()} disabled={busy || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-card border border-border p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Database className="size-4" /> RAG
            </h3>
            <div className="flex items-center justify-between mb-3">
              <Label htmlFor="rag" className="text-xs">
                Ativar busca na base
              </Label>
              <Switch id="rag" checked={useRag} onCheckedChange={setUseRag} />
            </div>
            <div className="flex items-center justify-between mb-3">
              <Label htmlFor="topk" className="text-xs">
                Top-K
              </Label>
              <Input
                id="topk"
                type="number"
                min={1}
                max={10}
                value={topK}
                onChange={(e) => setTopK(Math.max(1, Math.min(10, +e.target.value || 3)))}
                className="w-20 h-8"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {chunksLoading
                ? "Carregando chunks..."
                : ragInfo && ragInfo.docCount > 0
                  ? `${ragInfo.docCount} doc(s) · ${ragInfo.chunkCount} chunks carregados`
                  : "Nenhum documento na base de conhecimento."}
            </p>
          </div>

          <div className="rounded-2xl bg-gradient-card border border-border p-5">
            <h3 className="font-semibold text-sm mb-3">Configuração ativa</h3>
            {agent ? (
              <dl className="text-xs space-y-2">
                <Row label="Provedor" value={provider?.name ?? "—"} />
                <Row label="Modelo" value={agent.model || "—"} />
                <Row label="Temperatura" value={String(agent.temperature)} />
                <Row label="Persona" value={agent.persona?.name || "—"} />
                <Row label="Versão prompt" value={`v${agent.promptVersion}`} />
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum agente selecionado.</p>
            )}
          </div>

          {stats && (
            <div className="rounded-2xl bg-gradient-card border border-border p-5">
              <h3 className="font-semibold text-sm mb-3">Última execução</h3>
              <dl className="text-xs space-y-2">
                <Row label="Tokens IN" value={stats.tokensIn.toLocaleString()} />
                <Row label="Tokens OUT" value={stats.tokensOut.toLocaleString()} />
                <Row label="Duração" value={`${stats.ms} ms`} />
                <Row label="Chunks RAG" value={String(stats.ragUsed)} />
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição de resposta do agente */}
      <Dialog
        open={editingIdx !== null}
        onOpenChange={(o) => {
          if (!o) setEditingIdx(null);
        }}
      >
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar resposta do agente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="text-sm min-h-[320px] bg-background text-foreground font-sans resize-y"
              placeholder="Edite a resposta do agente..."
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              {editContent.length.toLocaleString()} caracteres
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditingIdx(null)}>
                <X className="size-4 mr-1.5" /> Cancelar
              </Button>
              <Button
                variant="hero"
                onClick={() => {
                  if (editingIdx === null) return;
                  const updated = [...msgs];
                  updated[editingIdx] = { ...updated[editingIdx], content: editContent };
                  setMsgs(updated);
                  setEditingIdx(null);
                  toast.success("Resposta editada!");
                }}
              >
                <Check className="size-4 mr-1.5" /> Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogContent className="max-w-xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Salvar como FAQ na Base de Conhecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título do Documento</Label>
              <Input
                value={faqTitle}
                onChange={(e) => setFaqTitle(e.target.value)}
                placeholder="Ex: FAQ - Horário de Funcionamento"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Provedor de Embeddings</Label>
                <Select
                  value={faqProviderId}
                  onValueChange={(val) => {
                    setFaqProviderId(val);
                    const p = providers.find((x) => x.id === val);
                    if (p?.kind === "google") {
                      setFaqEmbedModel("gemini-embedding-2");
                    } else if (p?.kind === "openrouter") {
                      setFaqEmbedModel("openai/text-embedding-3-small");
                    } else {
                      setFaqEmbedModel("text-embedding-3-small");
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione provedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {embedProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Modelo de Embedding</Label>
                <Input
                  value={faqEmbedModel}
                  onChange={(e) => setFaqEmbedModel(e.target.value)}
                  className="h-9"
                  placeholder="text-embedding-3-small"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pergunta do Cliente</Label>
              <Input
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                placeholder="Como funciona..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resposta do Agente (Editada)</Label>
              <Textarea
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                rows={5}
                placeholder="A nossa empresa funciona..."
                className="text-xs"
              />
            </div>

            <Button
              variant="hero"
              className="w-full"
              onClick={saveFaq}
              disabled={faqIngesting || embedProviders.length === 0}
            >
              {faqIngesting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Indexando FAQ...
                </>
              ) : (
                "Salvar na Base de Conhecimento"
              )}
            </Button>

            {embedProviders.length === 0 && (
              <p className="text-[10px] text-amber-500 text-center">
                Você precisa cadastrar um provedor compatível com embeddings (Gemini ou OpenAI) para
                salvar FAQs.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium truncate">{value}</dd>
    </div>
  );
}
