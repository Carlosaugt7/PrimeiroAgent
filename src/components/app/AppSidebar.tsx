import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Bot, MessagesSquare, Database, Smartphone,
  CreditCard, Users, Settings, ShieldCheck, Sparkles, Plug, ScrollText, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/app/agents", label: "Agentes", icon: Bot },
  { to: "/app/inbox", label: "Inbox", icon: MessagesSquare },
  { to: "/app/knowledge", label: "Conhecimento", icon: Database },
  { to: "/app/whatsapp", label: "WhatsApp", icon: Smartphone },
  { to: "/app/integrations", label: "Integrações", icon: Plug },
  { to: "/app/logs", label: "Logs & Traces", icon: ScrollText },
  { to: "/app/deploy", label: "Deploy", icon: Rocket },
  { to: "/app/billing", label: "Planos & uso", icon: CreditCard },
  { to: "/app/team", label: "Equipe", icon: Users },
  { to: "/app/settings", label: "Configurações", icon: Settings },
  { to: "/app/admin", label: "Admin SaaS", icon: ShieldCheck },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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

      <div className="mt-4 flex flex-col gap-1">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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

      <div className="mt-auto rounded-xl bg-gradient-card border border-border p-4">
        <p className="text-xs text-muted-foreground">Workspace</p>
        <p className="font-display font-semibold">Acme Comércio Ltda</p>
        <p className="text-xs text-muted-foreground mt-1">Plano Pro · 30/06</p>
      </div>
    </aside>
  );
}
