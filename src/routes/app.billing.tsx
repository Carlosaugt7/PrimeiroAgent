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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
  MessageSquare,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Planos & faturamento — AgentFlow IA" }] }),
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

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

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

  // Token usage metrics
  const [metrics, setMetrics] = useState<
    {
      date: string;
      tokens: number;
      messages: number;
    }[]
  >([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [agentMetrics, setAgentMetrics] = useState<{ name: string; value: number }[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [roiValue, setRoiValue] = useState(0);

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

    // Fetch token analytics
    (async () => {
      setLoadingMetrics(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from("ai_logs")
          .select("createdAt, agentName, inputTokens, outputTokens")
          .eq("tenantId", tenant.id)
          .gte("createdAt", thirtyDaysAgo.toISOString());

        if (data && !error) {
          const dateMap: Record<string, { tokens: number; messages: number }> = {};
          const agentMap: Record<string, number> = {};
          let tTokens = 0;
          const tMsgs = data.length;

          for (const row of data) {
            const dateStr = new Date(row.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            });
            const total =
              ((row as unknown as { inputTokens?: number; outputTokens?: number }).inputTokens ||
                0) +
              ((row as unknown as { inputTokens?: number; outputTokens?: number }).outputTokens ||
                0);
            tTokens += total;

            if (!dateMap[dateStr]) {
              dateMap[dateStr] = { tokens: 0, messages: 0 };
            }
            dateMap[dateStr].tokens += total;
            dateMap[dateStr].messages += 1;

            const agentName = row.agentName || "Desconhecido";
            agentMap[agentName] = (agentMap[agentName] || 0) + total;
          }

          const chartData = Object.keys(dateMap)
            .map((date) => ({
              date,
              tokens: dateMap[date].tokens,
              messages: dateMap[date].messages,
            }))
            .reverse()
            .slice(0, 15);

          const pieData = Object.keys(agentMap).map((name) => ({
            name,
            value: agentMap[name],
          }));

          setMetrics(chartData);
          setAgentMetrics(pieData);
          setTotalTokens(tTokens);
          setTotalMessages(tMsgs);
        }

        // Fetch ROI metrics from conversations
        const { data: convData, error: convError } = await supabase
          .from("conversations")
          .select("convertedValue")
          .eq("tenantId", tenant.id);

        if (convData && !convError) {
          const totalVal = convData.reduce((acc, c) => acc + Number(c.convertedValue || 0), 0);
          setRoiValue(totalVal);
        }
      } catch (e) {
        console.warn("Erro ao carregar métricas:", e);
      } finally {
        setLoadingMetrics(false);
      }
    })();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  const currentPlan = tenant?.plan ?? "trial";
  const totalPaid = useMemo(
    () => invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0),
    [invoices],
  );

  const estimatedCost = useMemo(
    () => (totalTokens / 1000) * 0.015, // Custo estimado fictício de $0.015 por 1k tokens em R$
    [totalTokens],
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
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar checkout");
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
            {tenant?.planExpiresAt && (
              <>
                {" · "}Validade:{" "}
                <span className="font-semibold text-foreground">
                  {new Date(tenant.planExpiresAt).toLocaleDateString("pt-BR")}
                  {(() => {
                    const diff = new Date(tenant.planExpiresAt).getTime() - Date.now();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    return days > 0
                      ? ` (${days} ${days === 1 ? "dia restante" : "dias restantes"})`
                      : " (Expirado)";
                  })()}
                </span>
              </>
            )}
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

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="usage">Uso &amp; Métricas</TabsTrigger>
          <TabsTrigger value="invoices">Faturas</TabsTrigger>
        </TabsList>

        {/* TAB 1: PLANS */}
        <TabsContent value="plans" className="space-y-6 pt-4">
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
                    <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">
                      {p.description}
                    </p>
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
        </TabsContent>

        {/* TAB 2: USAGE & METRICS */}
        <TabsContent value="usage" className="space-y-6 pt-4">
          {loadingMetrics ? (
            <div className="flex items-center justify-center p-12 min-h-[30vh]">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metrics cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="rounded-2xl border border-border bg-gradient-card p-6 space-y-2 border-emerald-500/25 bg-emerald-500/5 shadow-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Receita Gerada
                    </span>
                    <DollarSign className="size-4 text-emerald-400 animate-pulse" />
                  </div>
                  <p className="font-display text-2xl font-bold text-emerald-400">
                    R${" "}
                    {roiValue.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ROI gerado por fechamentos/agendamentos
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-gradient-card p-6 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Total de Tokens
                    </span>
                    <Zap className="size-4 text-amber-500" />
                  </div>
                  <p className="font-display text-2xl font-bold">{totalTokens.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Soma de Prompt e Completion
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-gradient-card p-6 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Mensagens IA
                    </span>
                    <MessageSquare className="size-4 text-blue-500" />
                  </div>
                  <p className="font-display text-2xl font-bold">
                    {totalMessages.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Interações nos últimos 30 dias
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-gradient-card p-6 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Custo Estimado
                    </span>
                    <DollarSign className="size-4 text-emerald-500" />
                  </div>
                  <p className="font-display text-2xl font-bold">
                    R${" "}
                    {estimatedCost.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Simulação com base no uso de tokens
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-gradient-card p-6 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Eficiência
                    </span>
                    <TrendingUp className="size-4 text-purple-500" />
                  </div>
                  <p className="font-display text-2xl font-bold">
                    {(totalMessages > 0
                      ? Math.round(totalTokens / totalMessages)
                      : 0
                    ).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Média de tokens por mensagem
                  </p>
                </div>
              </div>

              {/* Charts area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-border bg-gradient-card p-6 space-y-4">
                  <h3 className="font-semibold text-sm">
                    Histórico de Uso Diário (Tokens &amp; Mensagens)
                  </h3>
                  {metrics.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-xs text-muted-foreground">
                      Nenhum dado registrado nos últimos 30 dias.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={metrics}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d2d30" />
                          <XAxis dataKey="date" stroke="#888888" fontSize={10} />
                          <YAxis stroke="#888888" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e1e1e",
                              border: "1px solid #2d2d30",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="tokens"
                            name="Tokens"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorTokens)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-gradient-card p-6 space-y-4">
                  <h3 className="font-semibold text-sm">Consumo de Tokens por Agente</h3>
                  {agentMetrics.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-xs text-muted-foreground">
                      Sem dados de agentes.
                    </div>
                  ) : (
                    <div className="h-64 w-full flex flex-col justify-between">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={agentMetrics}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {agentMetrics.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1e1e1e",
                                border: "1px solid #2d2d30",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1 text-xs">
                        {agentMetrics.map((am, i) => (
                          <div key={am.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              <span className="text-muted-foreground truncate max-w-[120px]">
                                {am.name}
                              </span>
                            </div>
                            <span className="font-semibold">
                              {((am.value / totalTokens) * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: INVOICES */}
        <TabsContent value="invoices" className="pt-4">
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
        </TabsContent>
      </Tabs>

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
