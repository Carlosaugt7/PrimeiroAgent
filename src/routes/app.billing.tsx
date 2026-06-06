import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Check, Download } from "lucide-react";

export const Route = createFileRoute("/app/billing")({
  component: Billing,
});

const plans = [
  { name: "Starter", price: "R$ 197", features: ["1 agente", "1.000 msgs/mês", "1 número WhatsApp"] },
  { name: "Pro", price: "R$ 597", current: true, features: ["5 agentes", "10.000 msgs/mês", "5 números WhatsApp", "Automações"] },
  { name: "Enterprise", price: "Sob consulta", features: ["Ilimitado", "SSO + RBAC", "SLA 99.9%"] },
];

const invoices = [
  { id: "INV-2026-006", date: "01/06/2026", amount: "R$ 597,00", status: "pago" },
  { id: "INV-2026-005", date: "01/05/2026", amount: "R$ 597,00", status: "pago" },
  { id: "INV-2026-004", date: "01/04/2026", amount: "R$ 597,00", status: "pago" },
];

function Billing() {
  const { plan } = useAppStore();
  const pct = Math.round((plan.messagesUsed / plan.messagesLimit) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Planos & uso</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua assinatura e acompanhe consumo.</p>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-primary/30 p-6 shadow-glow">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-accent uppercase tracking-wider">Plano atual</p>
            <h2 className="font-display text-2xl font-bold mt-1">{plan.name} · {plan.price}/mês</h2>
            <p className="text-xs text-muted-foreground mt-1">Renova em {plan.renewsAt}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Cancelar assinatura</Button>
            <Button variant="hero">Fazer upgrade</Button>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Mensagens consumidas</span>
            <span className="font-mono">{plan.messagesUsed.toLocaleString("pt-BR")} / {plan.messagesLimit.toLocaleString("pt-BR")}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p.name} className={`rounded-2xl p-6 border ${p.current ? "bg-gradient-card border-primary/50 shadow-glow" : "bg-gradient-card border-border"}`}>
            <h3 className="font-display text-lg font-semibold">{p.name}</h3>
            <p className="font-display text-3xl font-bold mt-2">{p.price}</p>
            <ul className="mt-5 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="size-4 text-success" /> {f}
                </li>
              ))}
            </ul>
            <Button variant={p.current ? "outline" : "hero"} className="w-full mt-6" disabled={p.current}>
              {p.current ? "Plano atual" : "Selecionar"}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Faturas</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground tracking-wider bg-secondary/40">
            <tr><th className="text-left px-5 py-3">Nº</th><th className="text-left px-5 py-3">Data</th><th className="text-left px-5 py-3">Valor</th><th className="text-left px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-5 py-3 font-mono">{i.id}</td>
                <td className="px-5 py-3 text-muted-foreground">{i.date}</td>
                <td className="px-5 py-3">{i.amount}</td>
                <td className="px-5 py-3"><span className="text-xs px-2 py-1 rounded-full bg-success/15 text-success capitalize">{i.status}</span></td>
                <td className="px-5 py-3 text-right">
                  <button className="text-muted-foreground hover:text-foreground"><Download className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
