import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agents/$id")({
  component: AgentDetail,
});

type Tab = "prompt" | "conhecimento" | "whatsapp" | "playground" | "config";

function AgentDetail() {
  const { id } = Route.useParams();
  const { agents, updateAgent, deleteAgent, docs } = useAppStore();
  const navigate = useNavigate();
  const agent = agents.find((a) => a.id === id);
  const [tab, setTab] = useState<Tab>("prompt");
  const [draft, setDraft] = useState(agent?.systemPrompt ?? "");
  const [msgs, setMsgs] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: `Olá! Sou ${agent?.name ?? "o agente"}. Como posso ajudar?` },
  ]);
  const [input, setInput] = useState("");

  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Agente não encontrado.</p>
        <Link to="/app/agents" className="text-accent text-sm hover:underline">Voltar para agentes</Link>
      </div>
    );
  }

  const agentDocs = docs.filter((d) => d.agentId === agent.id);

  const sendMsg = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: input }, { role: "bot", text: "Entendi. Em breve respondo com base no seu treinamento. (preview)" }]);
    setInput("");
  };

  const handleDelete = () => {
    deleteAgent(agent.id);
    navigate({ to: "/app/agents" });
  };

  return (
    <div className="space-y-6">
      <Link to="/app/agents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="size-14 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
          <Bot className="size-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{agent.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] px-2 py-1 rounded-full ${agent.status === "online" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{agent.status}</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">{agent.model}</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">{agent.segment}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete}><Trash2 className="size-4" /> Excluir</Button>
          <Button variant="hero" onClick={() => updateAgent(agent.id, { systemPrompt: draft, status: "online" })}>Publicar alterações</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {(["prompt", "conhecimento", "whatsapp", "playground", "config"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize whitespace-nowrap",
            tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}>{t}</button>
        ))}
      </div>

      {tab === "prompt" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
          <div>
            <h2 className="font-display font-semibold">Prompt do sistema</h2>
            <p className="text-xs text-muted-foreground">Define a personalidade, regras e tom do agente.</p>
          </div>
          <textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)}
            className="w-full p-4 rounded-lg bg-secondary border border-border text-sm resize-none font-mono" />
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-muted-foreground">Modelo</span>
              <select value={agent.model} onChange={(e) => updateAgent(agent.id, { model: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                {["gpt-4o-mini", "gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Temperatura ({agent.temperature})</span>
              <input type="range" min={0} max={1} step={0.1} value={agent.temperature}
                onChange={(e) => updateAgent(agent.id, { temperature: parseFloat(e.target.value) })}
                className="mt-3 w-full accent-primary" />
            </label>
          </div>
        </div>
      )}

      {tab === "conhecimento" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display font-semibold mb-1">Base de conhecimento</h2>
          <p className="text-xs text-muted-foreground mb-4">{agentDocs.length} documento(s) treinando este agente.</p>
          <div className="space-y-2">
            {agentDocs.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum documento conectado ainda.</p>}
            {agentDocs.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.type.toUpperCase()} · {d.sizeKb} KB · {d.uploadedAt}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-success/15 text-success">indexado</span>
              </div>
            ))}
          </div>
          <Link to="/app/knowledge"><Button variant="outline" className="mt-4">Gerenciar base de conhecimento</Button></Link>
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display font-semibold mb-1">Conexão WhatsApp</h2>
          <p className="text-xs text-muted-foreground mb-4">Status: <span className="text-foreground">{agent.whatsapp}</span></p>
          {agent.whatsappNumber && <p className="text-sm">Número conectado: <span className="font-mono">{agent.whatsappNumber}</span></p>}
          <Link to="/app/whatsapp"><Button variant="hero" className="mt-4">Abrir gerenciamento</Button></Link>
        </div>
      )}

      {tab === "playground" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6 max-w-2xl">
          <h2 className="font-display font-semibold mb-4">Playground</h2>
          <div className="h-80 overflow-y-auto space-y-3 p-4 rounded-lg bg-secondary/40 border border-border mb-3">
            {msgs.map((m, i) => (
              <div key={i} className={cn("max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm", m.role === "user" ? "ml-auto bg-gradient-primary text-primary-foreground" : "bg-card border border-border")}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()}
              placeholder="Digite uma mensagem..."
              className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm" />
            <Button variant="hero" onClick={sendMsg}><Send className="size-4" /></Button>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4 max-w-2xl">
          <h2 className="font-display font-semibold">Configurações</h2>
          <label className="block">
            <span className="text-xs text-muted-foreground">Nome</span>
            <input defaultValue={agent.name} onBlur={(e) => updateAgent(agent.id, { name: e.target.value })}
              className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Descrição</span>
            <input defaultValue={agent.description} onBlur={(e) => updateAgent(agent.id, { description: e.target.value })}
              className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
          </label>
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-destructive">Zona de perigo</p>
            <Button variant="outline" className="mt-2 text-destructive border-destructive/40" onClick={handleDelete}>
              <Trash2 className="size-4" /> Excluir agente permanentemente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
