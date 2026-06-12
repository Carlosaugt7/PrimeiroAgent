import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import {
  ArrowUpRight,
  Bot,
  BotOff,
  CheckCircle2,
  Compass,
  Cpu,
  MessageCircle,
  Plug,
  Smartphone,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Icon className="size-5 text-primary-foreground" />
        </div>
        {hint && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="size-3" /> {hint}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Overview() {
  const { agents, conversations, instances, providers, plan } = useAppStore();
  const { profile, tenant } = useAuth();

  const online = agents.filter((a) => {
    const linkedInstance = instances.find((inst) => inst.name === a.whatsappInstanceId);
    const currentStatus = linkedInstance ? linkedInstance.status : a.status;
    return currentStatus === "online";
  }).length;
  const totalMsgs = agents.reduce((s, a) => s + (a.messages30d || 0), 0);
  const totalConv = agents.reduce((s, a) => s + (a.conversions30d || 0), 0);
  const connected = instances.filter((i) => i.status === "online").length;

  const empty = agents.length === 0 && providers.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Olá, {profile?.displayName?.split(" ")[0] || "bem-vindo"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Workspace <strong>{tenant?.name}</strong> · plano{" "}
            <span className="capitalize">{tenant?.plan}</span>
          </p>
        </div>
        <Link to="/app/agents">
          <Button variant="hero">
            <Bot className="size-4" /> Criar agente
          </Button>
        </Link>
      </div>

      {tenant && !tenant.onboardedAt && (
        <Link
          to="/app/onboarding"
          className="block rounded-2xl border border-accent/40 bg-accent/5 p-5 hover:bg-accent/10 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
              <Compass className="size-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-display font-semibold">Termine de configurar sua workspace</p>
              <p className="text-sm text-muted-foreground">
                Siga o guia de início rápido em 5 passos.
              </p>
            </div>
            <ArrowUpRight className="size-5 text-accent" />
          </div>
        </Link>
      )}

      {empty && (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <h2 className="font-display text-xl font-bold">Comece em 3 passos</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Sua workspace está vazia. Vamos configurar.
          </p>
          <div className="grid md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            <Step
              n={1}
              title="Cadastre um provedor LLM"
              desc="OpenAI, Anthropic, Gemini, Groq..."
              to="/app/llm-providers"
              icon={Cpu}
            />
            <Step
              n={2}
              title="Crie seu primeiro agente"
              desc="Persona, prompt e modelo"
              to="/app/agents"
              icon={Bot}
            />
            <Step
              n={3}
              title="Conecte um WhatsApp"
              desc="Via Evolution API"
              to="/app/whatsapp"
              icon={Smartphone}
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bot} label="Agentes online" value={`${online}/${agents.length}`} />
        <StatCard
          icon={MessageCircle}
          label="Mensagens (30d)"
          value={totalMsgs.toLocaleString("pt-BR")}
        />
        <StatCard
          icon={TrendingUp}
          label="Conversões (30d)"
          value={totalConv.toLocaleString("pt-BR")}
        />
        <StatCard
          icon={Smartphone}
          label="WhatsApp conectados"
          value={`${connected}/${instances.length}`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-card border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Agentes</h2>
            <Link
              to="/app/agents"
              className="text-xs text-accent flex items-center gap-1 hover:underline"
            >
              Ver todos <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agente ainda.</p>
          ) : (
            <div className="space-y-4">
              {agents.slice(0, 6).map((a) => {
                const pct = Math.min(100, Math.round(((a.messages30d || 0) / 5000) * 100));
                const linkedInstance = instances.find((inst) => inst.name === a.whatsappInstanceId);
                const currentStatus = linkedInstance ? linkedInstance.status : a.status;
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${currentStatus === "online" ? "bg-success" : currentStatus === "treinando" ? "bg-accent" : "bg-muted-foreground"}`}
                        />
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground text-xs">· {a.segment}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {(a.messages30d || 0).toLocaleString("pt-BR")} msgs
                      </span>
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
          <Row
            icon={Cpu}
            label="Provedores LLM"
            value={String(providers.length)}
            to="/app/llm-providers"
          />
          <Row
            icon={Smartphone}
            label="Instâncias WhatsApp"
            value={`${connected}/${instances.length}`}
            to="/app/whatsapp"
          />
          <Row
            icon={Plug}
            label="Mensagens do plano"
            value={`${plan.messagesUsed}/${plan.messagesLimit}`}
            to="/app/billing"
          />
          <Row
            icon={MessageCircle}
            label="Conversas"
            value={String(conversations.length)}
            to="/app/inbox"
          />
        </div>
      </div>

      <LiveMetrics />
    </div>
  );
}

function LiveMetrics() {
  const { conversations } = useAppStore();

  const metrics = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const abertas = conversations.filter((c) => c.status === "aberta").length;
    const resolvidas = conversations.filter((c) => c.status === "resolvida").length;
    const handoff = conversations.filter((c) => c.status === "handoff" || c.botPaused).length;
    const unique = new Set(conversations.map((c) => c.contactPhone)).size;

    // série últimos 7 dias por updatedAt
    const series: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = now - i * day;
      const d = new Date(start);
      const key = d.toISOString().slice(0, 10);
      const count = conversations.filter((c) => (c.updatedAt ?? "").slice(0, 10) === key).length;
      series.push({
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        value: count,
      });
    }

    // top tags
    const tagCount = new Map<string, number>();
    conversations.forEach((c) =>
      (c.tags ?? []).forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)),
    );
    const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { abertas, resolvidas, handoff, unique, series, topTags };
  }, [conversations]);

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 rounded-2xl bg-gradient-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Conversas — últimos 7 dias</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Atualizadas no período</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-1">
              <MessageCircle className="size-3" /> {metrics.abertas} abertas
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" /> {metrics.resolvidas} resolvidas
            </Badge>
            <Badge variant="outline" className="gap-1">
              <BotOff className="size-3" /> {metrics.handoff} handoff
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="size-3" /> {metrics.unique} contatos
            </Badge>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.series}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="url(#g1)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border p-6">
        <h2 className="font-display text-lg font-semibold mb-3">Top tags</h2>
        {metrics.topTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tag ainda. Adicione tags no Inbox para segmentar contatos.
          </p>
        ) : (
          <div className="space-y-2">
            {metrics.topTags.map(([t, n]) => {
              const max = metrics.topTags[0][1];
              const pct = Math.round((n / max) * 100);
              return (
                <div key={t}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{t}</span>
                    <span className="text-muted-foreground">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  desc,
  to,
  icon: Icon,
}: {
  n: number;
  title: string;
  desc: string;
  to: string;
  icon: typeof Bot;
}) {
  return (
    <Link
      to={to as never}
      className="rounded-xl border border-border p-4 text-left hover:border-primary/50 transition-colors block"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="size-6 rounded-full bg-gradient-primary grid place-items-center text-[11px] font-bold text-primary-foreground">
          {n}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </Link>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  to: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 hover:text-primary transition-colors"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
    </Link>
  );
}
