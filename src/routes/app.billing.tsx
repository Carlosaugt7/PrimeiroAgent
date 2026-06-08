import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PLANS, type BillingProvider, type PlanId } from "@/lib/billing-plans";
import { createCheckout } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, CreditCard, ExternalLink, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Planos & faturamento — AgentHub AI" }] }),
  component: BillingPage,
});

interface Invoice {
  id: string;
  provider: BillingProvider;
  amount: number;
  status: string;
  planId?: string;
  billingType?: string;
  invoiceUrl?: string;
  paidAt?: string;
  updatedAt?: string;
}

function BillingPage() {
  const { tenant, profile } = useAuth();
  const checkout = useServerFn(createCheckout);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("pro");
  const [provider, setProvider] = useState<BillingProvider>("asaas");
  const [name, setName] = useState(profile?.displayName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");

  useEffect(() => {
    if (!tenant?.id) return;

    const fetchInvoices = async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("updatedAt", { ascending: false });

      if (error) {
        console.warn("[billing] invoices:", error);
      } else if (data) {
        setInvoices(data as Invoice[]);
      }
    };

    fetchInvoices();

    const channel = supabase
      .channel("public:invoices")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `tenantId=eq.${tenant.id}` },
        () => {
          fetchInvoices();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  const currentPlan = tenant?.plan ?? "trial";
  const totalPaid = useMemo(
    () => invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0),
    [invoices],
  );

  const openCheckout = (planId: PlanId) => {
    setSelectedPlan(planId);
    setErr(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!tenant) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await checkout({
        data: {
          provider,
          planId: selectedPlan,
          tenantId: tenant.id,
          customer: { name, email, phone, cpfCnpj },
          successUrl:
            typeof window !== "undefined" ? `${window.location.origin}/app/billing` : undefined,
        },
      });
      window.open(res.url, "_blank", "noopener");
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao gerar checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Planos & faturamento</h1>
          <p className="text-muted-foreground mt-1">
            Plano atual:{" "}
            <span className="capitalize font-semibold text-foreground">{currentPlan}</span>
            {" · "}Total pago:{" "}
            <span className="font-semibold text-foreground">
              R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" />
          Pagamentos seguros via Asaas e Mercado Pago
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => {
          const isCurrent = currentPlan === p.id;
          const isFree = p.priceBRL <= 0;
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-2xl border p-6 flex flex-col gap-4 transition-all",
                p.highlight
                  ? "border-accent/60 bg-gradient-to-br from-accent/10 to-transparent shadow-glow"
                  : "border-border bg-gradient-card",
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  {p.highlight && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-accent">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description}</p>
              </div>
              <div>
                {isFree ? (
                  <p className="font-display text-3xl font-bold">
                    {p.id === "enterprise" ? "Sob consulta" : "Grátis"}
                  </p>
                ) : (
                  <p className="font-display text-3xl font-bold">
                    R$ {p.priceBRL}
                    <span className="text-sm text-muted-foreground font-normal">/mês</span>
                  </p>
                )}
              </div>
              <ul className="space-y-2 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="size-4 text-success shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button variant="outline" disabled className="w-full">
                  Plano atual
                </Button>
              ) : p.id === "enterprise" ? (
                <a href="mailto:contato@rsconsultoria.pro" className="w-full">
                  <Button variant="outline" className="w-full">
                    Falar com vendas
                  </Button>
                </a>
              ) : isFree ? (
                <Button variant="outline" disabled className="w-full">
                  Incluído
                </Button>
              ) : (
                <Button
                  variant={p.highlight ? "hero" : "outline"}
                  className="w-full"
                  onClick={() => openCheckout(p.id)}
                >
                  <CreditCard className="size-4" /> {p.cta ?? "Assinar"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Histórico de faturas</h2>
          <span className="text-xs text-muted-foreground">{invoices.length} registro(s)</span>
        </div>
        {invoices.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Sparkles className="size-8 mx-auto mb-2 opacity-60" />
            Nenhuma fatura ainda. Assine um plano para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Plano</th>
                  <th className="py-2 pr-4">Provedor</th>
                  <th className="py-2 pr-4">Método</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-border/40">
                    <td className="py-3 pr-4 text-muted-foreground">
                      {i.paidAt
                        ? new Date(i.paidAt).toLocaleDateString("pt-BR")
                        : i.updatedAt
                          ? new Date(i.updatedAt).toLocaleDateString("pt-BR")
                          : "—"}
                    </td>
                    <td className="py-3 pr-4 capitalize">{i.planId ?? "—"}</td>
                    <td className="py-3 pr-4 capitalize">{i.provider}</td>
                    <td className="py-3 pr-4 uppercase text-xs text-muted-foreground">
                      {i.billingType ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      R$ {(i.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-semibold uppercase",
                          i.status === "paid"
                            ? "bg-success/20 text-success"
                            : i.status === "pending"
                              ? "bg-accent/20 text-accent"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {i.invoiceUrl && (
                        <a
                          href={i.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline text-xs"
                        >
                          Abrir <ExternalLink className="size-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assinar plano {PLANS.find((p) => p.id === selectedPlan)?.name}
            </DialogTitle>
            <DialogDescription>
              Escolha o provedor e confirme seus dados. Você será redirecionado para o checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Provedor de pagamento</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {(["asaas", "mercadopago"] as BillingProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={cn(
                      "rounded-lg border p-3 text-sm font-medium capitalize transition-colors",
                      provider === p
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p === "asaas" ? "Asaas" : "Mercado Pago"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="bk-name">Nome completo</Label>
                <Input
                  id="bk-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="bk-email">E-mail</Label>
                <Input
                  id="bk-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bk-phone">Celular</Label>
                <Input
                  id="bk-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bk-doc">CPF/CNPJ</Label>
                <Input
                  id="bk-doc"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  placeholder="opcional"
                  className="mt-1"
                />
              </div>
            </div>

            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={submit} disabled={busy || !name || !email}>
              {busy && <Loader2 className="animate-spin size-4" />} Ir para checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
