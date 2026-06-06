import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Bot, Plus, Search, MoreVertical, MessageCircle, Smartphone } from "lucide-react";

export const Route = createFileRoute("/app/agents")({
  component: AgentsList,
});

const templates = [
  { name: "Vendas (SDR)", segment: "Vendas", desc: "Qualifica e converte leads" },
  { name: "Atendimento ao cliente", segment: "Suporte", desc: "Tira dúvidas e resolve tickets" },
  { name: "Clínica / Agendamento", segment: "Saúde", desc: "Marca consultas e confirma" },
  { name: "Imobiliária", segment: "Imobiliária", desc: "Captação e qualificação" },
];

function AgentsList() {
  const { agents, createAgent } = useAppStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", description: "", segment: "Vendas", model: "gpt-4o-mini", temperature: 0.4, systemPrompt: "Você é um assistente prestativo." });

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));

  const submit = () => {
    if (!form.name.trim()) return;
    createAgent(form);
    setOpen(false);
    setForm({ name: "", description: "", segment: "Vendas", model: "gpt-4o-mini", temperature: 0.4, systemPrompt: "Você é um assistente prestativo." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Agentes</h1>
          <p className="text-muted-foreground mt-1">Gerencie, treine e monitore seus agentes de IA.</p>
        </div>
        <Button variant="hero" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo agente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-secondary/60 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((a) => (
          <Link key={a.id} to="/app/agents/$id" params={{ id: a.id }} className="group rounded-2xl bg-gradient-card border border-border p-5 shadow-card hover:border-primary/40 hover:shadow-glow transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                <Bot className="size-5 text-primary-foreground" />
              </div>
              <button className="text-muted-foreground hover:text-foreground"><MoreVertical className="size-4" /></button>
            </div>
            <h3 className="font-display font-semibold">{a.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className={`text-[10px] px-2 py-1 rounded-full ${a.status === "online" ? "bg-success/15 text-success" : a.status === "treinando" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                {a.status}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">{a.segment}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-border">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="size-3" /> Mensagens</div>
                <p className="font-display font-semibold mt-0.5">{a.messages30d.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Smartphone className="size-3" /> WhatsApp</div>
                <p className="text-xs mt-1 truncate">{a.whatsappNumber ?? "—"}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-elegant p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Criar novo agente</h2>
            <p className="text-sm text-muted-foreground mt-1">Comece de um template ou personalize do zero.</p>

            <div className="grid grid-cols-2 gap-2 mt-5">
              {templates.map((t) => (
                <button key={t.name}
                  onClick={() => setForm((f) => ({ ...f, name: t.name, segment: t.segment, description: t.desc }))}
                  className="text-left rounded-lg border border-border p-3 hover:border-primary/50 transition-colors">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <Field label="Nome">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
              </Field>
              <Field label="Segmento">
                <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                  {["Vendas", "Suporte", "Saúde", "Imobiliária", "E-commerce", "Educação"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="Descrição">
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
                </Field>
              </div>
              <Field label="Modelo">
                <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                  {["gpt-4o-mini", "gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={`Temperatura (${form.temperature})`}>
                <input type="range" min={0} max={1} step={0.1} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="w-full accent-primary" />
              </Field>
              <div className="col-span-2">
                <Field label="Prompt do sistema">
                  <textarea rows={4} value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} className="w-full p-3 rounded-lg bg-secondary border border-border text-sm resize-none" />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="hero" onClick={submit}>Criar agente</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
