import { createFileRoute } from "@tanstack/react-router";
import { Building2, DollarSign, Users, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  component: AdminSaaS,
});

const tenants = [
  { name: "Acme Comércio", plan: "Pro", mrr: 597, agents: 5, status: "ativo" },
  { name: "Clínica Aurora", plan: "Starter", mrr: 197, agents: 1, status: "ativo" },
  { name: "Imobiliária Vega", plan: "Pro", mrr: 597, agents: 4, status: "ativo" },
  { name: "EduMax Cursos", plan: "Enterprise", mrr: 4900, agents: 28, status: "ativo" },
  { name: "Bistrô Norte", plan: "Starter", mrr: 197, agents: 1, status: "trial" },
  { name: "TechParts B2B", plan: "Pro", mrr: 597, agents: 3, status: "inadimplente" },
];

function AdminSaaS() {
  const mrr = tenants.reduce((s, t) => s + t.mrr, 0);
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-accent/15 text-accent mb-2">
          super-admin · interno
        </div>
        <h1 className="font-display text-3xl font-bold">Painel SaaS</h1>
        <p className="text-muted-foreground mt-1">Visão consolidada de todos os tenants da plataforma.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Building2} label="Tenants ativos" value={tenants.filter((t) => t.status === "ativo").length.toString()} />
        <Stat icon={DollarSign} label="MRR" value={`R$ ${mrr.toLocaleString("pt-BR")}`} delta="+12%" />
        <Stat icon={Users} label="Usuários totais" value="248" delta="+9%" />
        <Stat icon={TrendingUp} label="Churn (30d)" value="2.1%" />
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h2 className="font-display text-lg font-semibold">Tenants</h2>
          <input placeholder="Buscar tenant..." className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm w-64" />
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
            <tr><th className="text-left px-5 py-3">Empresa</th><th className="text-left px-5 py-3">Plano</th><th className="text-left px-5 py-3">MRR</th><th className="text-left px-5 py-3">Agentes</th><th className="text-left px-5 py-3">Status</th></tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.name} className="border-t border-border hover:bg-secondary/30">
                <td className="px-5 py-3 font-medium">{t.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{t.plan}</td>
                <td className="px-5 py-3">R$ {t.mrr.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3 text-muted-foreground">{t.agents}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    t.status === "ativo" ? "bg-success/15 text-success" :
                    t.status === "trial" ? "bg-accent/15 text-accent" :
                    "bg-destructive/15 text-destructive"
                  }`}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta }: { icon: typeof Building2; label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Icon className="size-5 text-primary-foreground" />
        </div>
        {delta && <span className="text-xs text-success">{delta}</span>}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
