import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Bot, MessagesSquare, Database, Smartphone,
  CreditCard, Users, Settings, ShieldCheck, Sparkles, Plug, ScrollText, Rocket,
  Cpu, FlaskConical, Contact, MessageSquareText, CalendarClock, BarChart3, Zap, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { to: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true },
      { to: "/app/agents", label: "Agentes", icon: Bot },
      { to: "/app/playground", label: "Playground", icon: FlaskConical },
      { to: "/app/inbox", label: "Inbox", icon: MessagesSquare },
      { to: "/app/crm", label: "Contatos (CRM)", icon: Contact },
      { to: "/app/templates", label: "Templates", icon: MessageSquareText },
      { to: "/app/scheduled", label: "Agendamentos", icon: CalendarClock },
      { to: "/app/automations", label: "Automações", icon: Zap },
    ],
  },
  {
    title: "Configuração",
    items: [
      { to: "/app/llm-providers", label: "Provedores LLM", icon: Cpu },
      { to: "/app/knowledge", label: "Conhecimento", icon: Database },
      { to: "/app/whatsapp", label: "WhatsApp", icon: Smartphone },
      { to: "/app/integrations", label: "Integrações", icon: Plug },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { to: "/app/reports", label: "Relatórios", icon: BarChart3 },
      { to: "/app/logs", label: "Logs & Traces", icon: ScrollText },
      { to: "/app/deploy", label: "Deploy", icon: Rocket },
      { to: "/app/billing", label: "Planos & uso", icon: CreditCard },
      { to: "/app/team", label: "Equipe", icon: Users },
      { to: "/app/settings", label: "Configurações", icon: Settings },
      { to: "/app/admin", label: "Master Admin", icon: ShieldCheck },
    ],
  },
];

export function AppSidebar({ tenantName, planName }: { tenantName: string; planName: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isMaster, profile, tenant, resetTenant } = useAuth();
  const impersonating = isMaster && profile && tenant && profile.tenantId !== tenant.id;
  const visibleGroups = isMaster
    ? [...groups, { title: "Plataforma (Master)", items: [{ to: "/app/master", label: "Master Admin", icon: Crown }] }]
    : groups;
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col gap-2 p-4 border-r border-border bg-card/40 backdrop-blur-xl">

      <Link to="/" className="flex items-center gap-2 px-2 py-3">
        <div className="size-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight">
          AgentHub<span className="text-gradient"> AI</span>
        </span>
      </Link>

      <div className="mt-2 flex flex-col gap-4 overflow-y-auto">
        {visibleGroups.map((g) => (
          <div key={g.title}>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{g.title}</p>
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to as never}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                      active
                        ? "bg-gradient-primary text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-xl bg-gradient-card border border-border p-4">
        <p className="text-xs text-muted-foreground">Workspace</p>
        <p className="font-display font-semibold truncate">{tenantName}</p>
        <p className="text-xs text-muted-foreground mt-1 capitalize">Plano {planName}</p>
      </div>
    </aside>
  );
}
