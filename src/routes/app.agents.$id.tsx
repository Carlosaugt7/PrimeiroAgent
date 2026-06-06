import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore, type AgentTool, type AgentTrigger, type AgentEnvVar } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Send, Trash2, Plus, Eye, EyeOff, Activity, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agents/$id")({
  component: AgentDetail,
});

const TABS = ["prompt", "modelo", "tools", "conhecimento", "memoria", "triggers", "env", "whatsapp", "playground", "json"] as const;
type Tab = (typeof TABS)[number];

function AgentDetail() {
  const { id } = Route.useParams();
  const { agents, updateAgent, deleteAgent, docs } = useAppStore();
  const navigate = useNavigate();
  const agent = agents.find((a) => a.id === id);
  const [tab, setTab] = useState<Tab>("prompt");
  const [draft, setDraft] = useState(agent?.systemPrompt ?? "");

  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Agente não encontrado.</p>
        <Link to="/app/agents" className="text-accent text-sm hover:underline">Voltar para agentes</Link>
      </div>
    );
  }

  const agentDocs = docs.filter((d) => d.agentId === agent.id);

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
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] px-2 py-1 rounded-full ${agent.status === "online" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{agent.status}</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">{agent.model}</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">{agent.segment}</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">memória: {agent.memory}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { deleteAgent(agent.id); navigate({ to: "/app/agents" }); }}>
            <Trash2 className="size-4" /> Excluir
          </Button>
          <Button variant="hero" onClick={() => updateAgent(agent.id, { systemPrompt: draft, status: "online" })}>Publicar alterações</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
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
            <p className="text-xs text-muted-foreground">Define personalidade, regras e tom do agente.</p>
          </div>
          <textarea rows={14} value={draft} onChange={(e) => setDraft(e.target.value)}
            className="w-full p-4 rounded-lg bg-secondary border border-border text-sm resize-none font-mono" />
        </div>
      )}

      {tab === "modelo" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4 max-w-3xl">
          <h2 className="font-display font-semibold">Modelo & Parâmetros</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider">
              <select value={agent.provider} onChange={(e) => updateAgent(agent.id, { provider: e.target.value as typeof agent.provider })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                {["openai", "anthropic", "google", "lovable"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Modelo">
              <select value={agent.model} onChange={(e) => updateAgent(agent.id, { model: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                {["gpt-4o-mini", "gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash", "google/gemini-2.5-flash"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Slider label={`Temperatura (${agent.temperature})`} min={0} max={1} step={0.1} value={agent.temperature} onChange={(v) => updateAgent(agent.id, { temperature: v })} />
            <Slider label={`Top P (${agent.topP})`} min={0} max={1} step={0.05} value={agent.topP} onChange={(v) => updateAgent(agent.id, { topP: v })} />
            <Field label="Max tokens">
              <input type="number" value={agent.maxTokens} onChange={(e) => updateAgent(agent.id, { maxTokens: parseInt(e.target.value) || 0 })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
            </Field>
            <Slider label={`Presence penalty (${agent.presencePenalty})`} min={-2} max={2} step={0.1} value={agent.presencePenalty} onChange={(v) => updateAgent(agent.id, { presencePenalty: v })} />
            <Slider label={`Frequency penalty (${agent.frequencyPenalty})`} min={-2} max={2} step={0.1} value={agent.frequencyPenalty} onChange={(v) => updateAgent(agent.id, { frequencyPenalty: v })} />
          </div>
        </div>
      )}

      {tab === "tools" && <ToolsTab tools={agent.tools} onChange={(tools) => updateAgent(agent.id, { tools })} />}

      {tab === "conhecimento" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display font-semibold mb-1">Base de conhecimento</h2>
          <p className="text-xs text-muted-foreground mb-4">{agentDocs.length} documento(s) treinando este agente.</p>
          <div className="space-y-2">
            {agentDocs.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum documento conectado ainda.</p>}
            {agentDocs.map((d) => (
              <div key={d.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.type.toUpperCase()} · {d.sizeKb} KB · {d.uploadedAt}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${d.status === "indexado" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>{d.status}</span>
                </div>
                {d.indexProgress < 100 && (
                  <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-primary transition-all" style={{ width: `${d.indexProgress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <Link to="/app/knowledge"><Button variant="outline" className="mt-4">Gerenciar base de conhecimento</Button></Link>
        </div>
      )}

      {tab === "memoria" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6 max-w-2xl">
          <h2 className="font-display font-semibold mb-3">Memória</h2>
          <div className="grid grid-cols-3 gap-3">
            {(["curto", "longo", "vetorial"] as const).map((m) => (
              <button key={m} onClick={() => updateAgent(agent.id, { memory: m })}
                className={cn("p-4 rounded-xl border text-left transition-all",
                  agent.memory === m ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/40")}>
                <p className="font-semibold capitalize">{m}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {m === "curto" ? "Lembra apenas da conversa atual" : m === "longo" ? "Histórico completo por contato" : "Embeddings + RAG (recomendado)"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "triggers" && <TriggersTab triggers={agent.triggers} onChange={(triggers) => updateAgent(agent.id, { triggers })} />}

      {tab === "env" && <EnvTab vars={agent.envVars} onChange={(envVars) => updateAgent(agent.id, { envVars })} />}

      {tab === "whatsapp" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display font-semibold mb-1">Conexão WhatsApp</h2>
          <p className="text-xs text-muted-foreground mb-4">Status: <span className="text-foreground">{agent.whatsapp}</span></p>
          {agent.whatsappNumber && <p className="text-sm">Número conectado: <span className="font-mono">{agent.whatsappNumber}</span></p>}
          <Link to="/app/whatsapp"><Button variant="hero" className="mt-4">Abrir gerenciamento</Button></Link>
        </div>
      )}

      {tab === "playground" && <PlaygroundTab agentName={agent.name} />}

      {tab === "json" && (
        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display font-semibold mb-3">JSON / YAML (somente leitura)</h2>
          <pre className="text-xs bg-secondary/60 border border-border rounded-lg p-4 overflow-x-auto font-mono">
{JSON.stringify(agent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolsTab({ tools, onChange }: { tools: AgentTool[]; onChange: (t: AgentTool[]) => void }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-6 max-w-3xl">
      <h2 className="font-display font-semibold mb-1">Tools</h2>
      <p className="text-xs text-muted-foreground mb-4">Habilite ferramentas que o agente pode invocar durante a conversa.</p>
      <div className="space-y-2">
        {tools.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center gap-3">
              <Wrench className="size-4 text-accent" />
              <div>
                <p className="font-mono text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </div>
            <Toggle on={t.enabled} onChange={(v) => onChange(tools.map((x) => x.id === t.id ? { ...x, enabled: v } : x))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TriggersTab({ triggers, onChange }: { triggers: AgentTrigger[]; onChange: (t: AgentTrigger[]) => void }) {
  const add = () => onChange([...triggers, { id: `tr_${Date.now()}`, type: "mensagem", label: "Novo trigger", config: "", enabled: true }]);
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold">Triggers</h2>
          <p className="text-xs text-muted-foreground">Quando o agente deve ser executado.</p>
        </div>
        <Button variant="outline" onClick={add}><Plus className="size-4" /> Adicionar</Button>
      </div>
      <div className="space-y-2">
        {triggers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum trigger configurado.</p>}
        {triggers.map((t) => (
          <div key={t.id} className="p-3 rounded-lg bg-secondary/50 border border-border grid grid-cols-[140px_1fr_1fr_auto_auto] gap-2 items-center">
            <select value={t.type} onChange={(e) => onChange(triggers.map((x) => x.id === t.id ? { ...x, type: e.target.value as typeof t.type } : x))} className="h-8 px-2 rounded-md bg-card border border-border text-xs">
              <option value="mensagem">Mensagem</option><option value="cron">Cron</option><option value="webhook">Webhook</option>
            </select>
            <input value={t.label} onChange={(e) => onChange(triggers.map((x) => x.id === t.id ? { ...x, label: e.target.value } : x))} className="h-8 px-2 rounded-md bg-card border border-border text-xs" />
            <input value={t.config} placeholder={t.type === "cron" ? "ex: 0 10 * * *" : "configuração"} onChange={(e) => onChange(triggers.map((x) => x.id === t.id ? { ...x, config: e.target.value } : x))} className="h-8 px-2 rounded-md bg-card border border-border text-xs font-mono" />
            <Toggle on={t.enabled} onChange={(v) => onChange(triggers.map((x) => x.id === t.id ? { ...x, enabled: v } : x))} />
            <button onClick={() => onChange(triggers.filter((x) => x.id !== t.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnvTab({ vars, onChange }: { vars: AgentEnvVar[]; onChange: (v: AgentEnvVar[]) => void }) {
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const add = () => onChange([...vars, { id: `e_${Date.now()}`, key: "NEW_VAR", value: "", secret: true }]);
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-semibold">Variáveis de ambiente</h2>
          <p className="text-xs text-muted-foreground">Secrets disponíveis para tools e webhooks do agente.</p>
        </div>
        <Button variant="outline" onClick={add}><Plus className="size-4" /> Adicionar</Button>
      </div>
      <div className="space-y-2">
        {vars.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma variável definida.</p>}
        {vars.map((v) => (
          <div key={v.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center p-3 rounded-lg bg-secondary/50 border border-border">
            <input value={v.key} onChange={(e) => onChange(vars.map((x) => x.id === v.id ? { ...x, key: e.target.value.toUpperCase() } : x))} className="h-8 px-2 rounded-md bg-card border border-border text-xs font-mono" />
            <input type={v.secret && !reveal[v.id] ? "password" : "text"} value={v.value} onChange={(e) => onChange(vars.map((x) => x.id === v.id ? { ...x, value: e.target.value } : x))} className="h-8 px-2 rounded-md bg-card border border-border text-xs font-mono" />
            <button onClick={() => setReveal((r) => ({ ...r, [v.id]: !r[v.id] }))} className="text-muted-foreground hover:text-foreground">
              {reveal[v.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <button onClick={() => onChange(vars.filter((x) => x.id !== v.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Trace { tool: string; ms: number; tokens: number }
function PlaygroundTab({ agentName }: { agentName: string }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: `Olá! Sou ${agentName}. Como posso ajudar?` },
  ]);
  const [input, setInput] = useState("");
  const [traces, setTraces] = useState<Trace[]>([
    { tool: "rag.search", ms: 142, tokens: 320 },
    { tool: "llm.generate", ms: 612, tokens: 180 },
  ]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: input }, { role: "bot", text: "Entendi. Em breve respondo com base no seu treinamento. (preview)" }]);
    setTraces((t) => [...t, { tool: "rag.search", ms: 100 + Math.floor(Math.random() * 200), tokens: 200 + Math.floor(Math.random() * 200) }, { tool: "llm.generate", ms: 400 + Math.floor(Math.random() * 400), tokens: 100 + Math.floor(Math.random() * 200) }]);
    setInput("");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="rounded-2xl bg-gradient-card border border-border p-6">
        <h2 className="font-display font-semibold mb-4">Playground</h2>
        <div className="h-80 overflow-y-auto space-y-3 p-4 rounded-lg bg-secondary/40 border border-border mb-3">
          {msgs.map((m, i) => (
            <div key={i} className={cn("max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm", m.role === "user" ? "ml-auto bg-gradient-primary text-primary-foreground" : "bg-card border border-border")}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Digite uma mensagem..."
            className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm" />
          <Button variant="hero" onClick={send}><Send className="size-4" /></Button>
        </div>
      </div>
      <div className="rounded-2xl bg-gradient-card border border-border p-5">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Activity className="size-4 text-accent" /> Traces</h3>
        <div className="space-y-2 text-xs font-mono">
          {traces.map((t, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-md bg-secondary/40 border border-border">
              <span>{t.tool}</span>
              <span className="text-muted-foreground">{t.ms}ms · {t.tokens}tk</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-3 w-full accent-primary" />
    </label>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={cn("relative w-10 h-6 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-background transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}
