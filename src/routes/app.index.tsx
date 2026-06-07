import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { ArrowUpRight, Bot, BotOff, CheckCircle2, Cpu, MessageCircle, Plug, Smartphone, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Bot; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Icon className="size-5 text-primary-foreground" />
        </div>
        {hint && <span className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> {hint}</span>}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Overview() {
  const { agents, conversations, instances, providers, plan } = useAppStore();
  const { profile, tenant } = useAuth();

  const online = agents.filter((a) => a.status === "online").length;
  const totalMsgs = agents.reduce((s, a) => s + (a.messages30d || 0), 0);
  const totalConv = agents.reduce((s, a) => s + (a.conversions30d || 0), 0);
  const connected = instances.filter((i) => i.status === "online").length;

  const empty = agents.length === 0 && providers.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Olá, {profile?.displayName?.split(" ")[0] || "bem-vindo"} 👋</h1>
          <p className="text-muted-foreground mt-1">Workspace <strong>{tenant?.name}</strong> · plano <span className="capitalize">{tenant?.plan}</span></p>
        </div>
        <Link to="/app/agents">
          <Button variant="hero"><Bot className="size-4" /> Criar agente</Button>
        </Link>
      </div>

      {empty && (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <h2 className="font-display text-xl font-bold">Comece em 3 passos</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Sua workspace está vazia. Vamos configurar.</p>
          <div className="grid md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            <Step n={1} title="Cadastre um provedor LLM" desc="OpenAI, Anthropic, Gemini, Groq..." to="/app/llm-providers" icon={Cpu} />
            <Step n={2} title="Crie seu primeiro agente" desc="Persona, prompt e modelo" to="/app/agents" icon={Bot} />
            <Step n={3} title="Conecte um WhatsApp" desc="Via Evolution API" to="/app/whatsapp" icon={Smartphone} />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bot} label="Agentes online" value={`${online}/${agents.length}`} />
        <StatCard icon={MessageCircle} label="Mensagens (30d)" value={totalMsgs.toLocaleString("pt-BR")} />
        <StatCard icon={TrendingUp} label="Conversões (30d)" value={totalConv.toLocaleString("pt-BR")} />
        <StatCard icon={Smartphone} label="WhatsApp conectados" value={`${connected}/${instances.length}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-card border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Agentes</h2>
            <Link to="/app/agents" className="text-xs text-accent flex items-center gap-1 hover:underline">
              Ver todos <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agente ainda.</p>
          ) : (
            <div className="space-y-4">
              {agents.slice(0, 6).map((a) => {
                const pct = Math.min(100, Math.round(((a.messages30d || 0) / 5000) * 100));
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${a.status === "online" ? "bg-success" : a.status === "treinando" ? "bg-accent" : "bg-muted-foreground"}`} />
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground text-xs">· {a.segment}</span>
                      </div>
                      <span className="text-muted-foreground">{(a.messages30d || 0).toLocaleString("pt-BR")} msgs</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Recursos</h2>
          <Row icon={Cpu} label="Provedores LLM" value={String(providers.length)} to="/app/llm-providers" />
          <Row icon={Smartphone} label="Instâncias WhatsApp" value={`${connected}/${instances.length}`} to="/app/whatsapp" />
          <Row icon={Plug} label="Mensagens do plano" value={`${plan.messagesUsed}/${plan.messagesLimit}`} to="/app/billing" />
          <Row icon={MessageCircle} label="Conversas" value={String(conversations.length)} to="/app/inbox" />
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, desc, to, icon: Icon }: { n: number; title: string; desc: string; to: string; icon: typeof Bot }) {
  return (
    <Link to={to as never} className="rounded-xl border border-border p-4 text-left hover:border-primary/50 transition-colors block">
      <div className="flex items-center gap-2 mb-2">
        <span className="size-6 rounded-full bg-gradient-primary grid place-items-center text-[11px] font-bold text-primary-foreground">{n}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </Link>
  );
}

function Row({ icon: Icon, label, value, to }: { icon: typeof Bot; label: string; value: string; to: string }) {
  return (
    <Link to={to as never} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 hover:text-primary transition-colors">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" /> {label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </Link>
  );
}
