import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { ArrowUpRight, Bot, MessageCircle, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  component: Overview,
});

function StatCard({ icon: Icon, label, value, delta }: { icon: typeof Bot; label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Icon className="size-5 text-primary-foreground" />
        </div>
        {delta && <span className="text-xs text-success flex items-center gap-1"><TrendingUp className="size-3" /> {delta}</span>}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Overview() {
  const { agents, conversations, plan } = useAppStore();
  const totalMsgs = agents.reduce((s, a) => s + a.messages30d, 0);
  const totalConv = agents.reduce((s, a) => s + a.conversions30d, 0);
  const online = agents.filter((a) => a.status === "online").length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bem-vinda, Ana 👋</h1>
          <p className="text-muted-foreground mt-1">Resumo dos últimos 30 dias da sua operação.</p>
        </div>
        <Link to="/app/agents">
          <Button variant="hero">
            <Bot className="size-4" /> Criar novo agente
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bot} label="Agentes online" value={`${online}/${agents.length}`} />
        <StatCard icon={MessageCircle} label="Mensagens (30d)" value={totalMsgs.toLocaleString("pt-BR")} delta="+18%" />
        <StatCard icon={TrendingUp} label="Conversões (30d)" value={totalConv.toLocaleString("pt-BR")} delta="+9%" />
        <StatCard icon={Zap} label="Uso do plano" value={`${Math.round((plan.messagesUsed / plan.messagesLimit) * 100)}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-card border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Performance por agente</h2>
            <Link to="/app/agents" className="text-xs text-accent flex items-center gap-1 hover:underline">
              Ver todos <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {agents.map((a) => {
              const pct = Math.min(100, Math.round((a.messages30d / 5000) * 100));
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${a.status === "online" ? "bg-success" : a.status === "treinando" ? "bg-accent" : "bg-muted-foreground"}`} />
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground text-xs">· {a.segment}</span>
                    </div>
                    <span className="text-muted-foreground">{a.messages30d.toLocaleString("pt-BR")} msgs</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-card border border-border p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Conversas recentes</h2>
          <div className="space-y-3">
            {conversations.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/40 transition-colors">
                <div className="size-9 rounded-full bg-secondary grid place-items-center text-xs font-semibold shrink-0">
                  {c.contactName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{c.contactName}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.updatedAt}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && <span className="size-5 rounded-full bg-gradient-primary text-[10px] font-bold grid place-items-center text-primary-foreground">{c.unread}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
