import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAppStore } from "@/lib/app-store";
import { chatCompletion } from "@/lib/llm.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/playground")({
  component: PlaygroundPage,
});

interface Msg { role: "user" | "assistant"; content: string }

const scenarios = [
  { name: "Cliente curioso", text: "Oi, quanto custa esse serviço?" },
  { name: "Cliente objeção preço", text: "Achei caro, vocês fazem desconto?" },
  { name: "Cliente suporte", text: "Meu pedido não chegou ainda, o que faço?" },
  { name: "Cliente quer humano", text: "Quero falar com um atendente real" },
];

function PlaygroundPage() {
  const { agents, providers } = useAppStore();
  const chat = useServerFn(chatCompletion);
  const [agentId, setAgentId] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ tokensIn: number; tokensOut: number; ms: number } | null>(null);

  const agent = agents.find((a) => a.id === agentId);
  const provider = providers.find((p) => p.id === agent?.providerId);

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
      const r = await chat({
        data: {
          kind: provider.kind, baseUrl: provider.baseUrl, apiKey: provider.apiKey,
          model: agent.model, systemPrompt: agent.systemPrompt,
          messages: newMsgs, temperature: agent.temperature,
        },
      });
      setMsgs([...newMsgs, { role: "assistant", content: r.text }]);
      setStats({ tokensIn: r.inputTokens, tokensOut: r.outputTokens, ms: r.durationMs });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro na chamada LLM");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Playground</h1>
        <p className="text-muted-foreground mt-1">Teste seus agentes antes de publicar.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="rounded-2xl bg-gradient-card border border-border flex flex-col h-[70vh]">
          <div className="p-4 border-b border-border flex items-center gap-3">
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
              </dl>
            </div>
          )}

          {agent && (
            <div className="rounded-2xl bg-gradient-card border border-border p-5">
              <h3 className="font-semibold text-sm mb-2">Prompt do sistema</h3>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{agent.systemPrompt}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium truncate">{value}</dd></div>
  );
}
