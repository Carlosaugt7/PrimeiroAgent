import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/app-store";
import { chatCompletion, embedTexts } from "@/lib/llm.functions";
import { db } from "@/integrations/firebase/client";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Sparkles, Trash2, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/playground")({ component: PlaygroundPage });

interface Msg { role: "user" | "assistant"; content: string }
interface KnowMeta { id: string; name: string; embedProviderId: string; embedModel: string; vectorDim: number }
interface Chunk { docId: string; docName: string; id: string; text: string; embedding: number[] }

const scenarios = [
  { name: "Cliente curioso", text: "Oi, quanto custa esse serviço?" },
  { name: "Objeção preço", text: "Achei caro, vocês fazem desconto?" },
  { name: "Suporte", text: "Meu pedido não chegou ainda, o que faço?" },
  { name: "Quer humano", text: "Quero falar com um atendente real" },
];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

function PlaygroundPage() {
  const { tenant } = useAuth();
  const { agents, providers } = useAppStore();
  const chat = useServerFn(chatCompletion);
  const embed = useServerFn(embedTexts);

  const [agentId, setAgentId] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ tokensIn: number; tokensOut: number; ms: number; ragUsed: number } | null>(null);

  const [useRag, setUseRag] = useState(true);
  const [topK, setTopK] = useState(3);
  const [knowDocs, setKnowDocs] = useState<KnowMeta[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  const agent = agents.find((a) => a.id === agentId);
  const provider = providers.find((p) => p.id === agent?.providerId);

  // Lista docs do tenant
  useEffect(() => {
    if (!tenant) return;
    return onSnapshot(collection(db, "tenants", tenant.id, "knowledge"), (s) => {
      setKnowDocs(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as KnowMeta[]);
    });
  }, [tenant]);

  // Carrega chunks dos docs cujo embedProviderId === provedor do agente
  useEffect(() => {
    if (!tenant || !provider) { setChunks([]); return; }
    const compatible = knowDocs.filter((d) => d.embedProviderId === provider.id);
    if (compatible.length === 0) { setChunks([]); return; }
    let cancelled = false;
    (async () => {
      setChunksLoading(true);
      try {
        const all: Chunk[] = [];
        for (const d of compatible) {
          const snap = await getDocs(collection(db, "tenants", tenant.id, "knowledge", d.id, "chunks"));
          snap.docs.forEach((c) => {
            const data = c.data() as { text: string; embedding: number[] };
            all.push({ docId: d.id, docName: d.name, id: c.id, text: data.text, embedding: data.embedding });
          });
        }
        if (!cancelled) setChunks(all);
      } finally { if (!cancelled) setChunksLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tenant, provider, knowDocs]);

  const ragInfo = useMemo(() => {
    if (!provider) return null;
    const compatible = knowDocs.filter((d) => d.embedProviderId === provider.id);
    const model = compatible[0]?.embedModel;
    return { docCount: compatible.length, chunkCount: chunks.length, model };
  }, [knowDocs, chunks, provider]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !agent || !provider) {
      if (!agent) toast.error("Selecione um agente");
      else if (!provider) toast.error("Agente sem provedor LLM configurado");
      return;
    }
    const newMsgs: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(newMsgs); setInput(""); setBusy(true);

    try {
      // RAG: busca top-K chunks relevantes
      let systemPrompt = agent.systemPrompt;
      let ragUsed = 0;
      if (useRag && chunks.length > 0 && ragInfo?.model) {
        try {
          const q = await embed({ data: { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: ragInfo.model, texts: [content] } });
          const qv = q.vectors[0];
          const scored = chunks
            .map((c) => ({ c, s: cosine(qv, c.embedding) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, topK)
            .filter((x) => x.s > 0.2);
          if (scored.length) {
            const context = scored.map((x, i) => `[${i + 1}] (${x.c.docName})\n${x.c.text}`).join("\n\n---\n\n");
            systemPrompt = `${agent.systemPrompt}\n\n## CONTEXTO RELEVANTE DA BASE DE CONHECIMENTO\nUse APENAS estas informações quando forem pertinentes. Se a resposta não estiver no contexto, diga que vai verificar.\n\n${context}`;
            ragUsed = scored.length;
          }
        } catch (e) {
          console.warn("[rag] embed query falhou:", e);
        }
      }

      const r = await chat({
        data: {
          kind: provider.kind, baseUrl: provider.baseUrl, apiKey: provider.apiKey,
          model: agent.model, systemPrompt,
          messages: newMsgs, temperature: agent.temperature,
        },
      });
      setMsgs([...newMsgs, { role: "assistant", content: r.text }]);
      setStats({ tokensIn: r.inputTokens, tokensOut: r.outputTokens, ms: r.durationMs, ragUsed });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro na chamada LLM");
    } finally { setBusy(false); }
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
            <Select value={agentId} onValueChange={(v) => { setAgentId(v); setMsgs([]); setStats(null); }}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Selecione um agente..." /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} <span className="text-muted-foreground">· {a.model || "sem modelo"}</span></SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setMsgs([]); setStats(null); }}><Trash2 className="size-4" /> Limpar</Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.length === 0 && (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <Sparkles className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Selecione um agente e envie uma mensagem.</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {scenarios.map((s) => (
                      <button key={s.name} onClick={() => send(s.text)} disabled={!agent} className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 disabled:opacity-50">
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="bg-secondary rounded-2xl px-4 py-2.5"><Loader2 className="animate-spin size-4" /></div></div>}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Digite a mensagem do cliente..." disabled={busy} />
            <Button variant="hero" onClick={() => send()} disabled={busy || !input.trim()}><Send className="size-4" /></Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-card border border-border p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Database className="size-4" /> RAG</h3>
            <div className="flex items-center justify-between mb-3">
              <Label htmlFor="rag" className="text-xs">Ativar busca na base</Label>
              <Switch id="rag" checked={useRag} onCheckedChange={setUseRag} />
            </div>
            <div className="flex items-center justify-between mb-3">
              <Label htmlFor="topk" className="text-xs">Top-K</Label>
              <Input id="topk" type="number" min={1} max={10} value={topK} onChange={(e) => setTopK(Math.max(1, Math.min(10, +e.target.value || 3)))} className="w-20 h-8" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {!provider ? "Selecione um agente." :
                chunksLoading ? "Carregando chunks..." :
                ragInfo && ragInfo.docCount > 0
                  ? `${ragInfo.docCount} doc(s) · ${ragInfo.chunkCount} chunks · ${ragInfo.model}`
                  : "Nenhum doc compatível com o provedor do agente."}
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
            ) : <p className="text-xs text-muted-foreground">Nenhum agente selecionado.</p>}
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium truncate">{value}</dd></div>;
}
