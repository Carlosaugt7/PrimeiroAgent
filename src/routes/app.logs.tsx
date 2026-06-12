import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText, CheckCircle2, AlertCircle, Bot, Clock, Search } from "lucide-react";

export const Route = createFileRoute("/app/logs")({
  head: () => ({ meta: [{ title: "Logs & Traces — AgentFlow IA" }] }),
  component: Logs,
});

interface LogRow {
  id: string;
  createdAt: string;
  agentId?: string;
  agentName?: string;
  providerKind?: string;
  model?: string;
  instanceName?: string;
  remoteJid?: string;
  conversationId?: string;
  userText?: string;
  reply?: string;
  systemPromptChars?: number;
  latencyMs?: number;
  ok?: boolean;
  error?: string | null;
}

function Logs() {
  const { tenant } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<LogRow | null>(null);

  useEffect(() => {
    if (!tenant) return;

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("ai_logs")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("createdAt", { ascending: false })
        .limit(200);

      if (error) {
        console.warn("[logs]", error);
      } else if (data) {
        setRows(data as LogRow[]);
      }
    };

    fetchLogs();

    const channel = supabase
      .channel("public:ai_logs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_logs",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchLogs,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.agentName, r.model, r.instanceName, r.userText, r.reply, r.error, r.remoteJid]
        .map((x) => (x ?? "").toLowerCase())
        .some((x) => x.includes(q)),
    );
  }, [rows, filter]);

  const kpis = useMemo(() => {
    const okCount = rows.filter((r) => r.ok).length;
    const avg = rows.length
      ? Math.round(rows.reduce((a, r) => a + (r.latencyMs ?? 0), 0) / rows.length)
      : 0;
    return { total: rows.length, ok: okCount, fail: rows.length - okCount, avg };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <ScrollText className="size-7 text-primary" /> Logs & Traces
        </h1>
        <p className="text-muted-foreground mt-1">
          Últimas 200 chamadas de IA do tenant (auto-resposta no WhatsApp).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Bot className="size-4" />} label="Total" value={kpis.total} />
        <Kpi
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          label="OK"
          value={kpis.ok}
        />
        <Kpi
          icon={<AlertCircle className="size-4 text-destructive" />}
          label="Falhas"
          value={kpis.fail}
        />
        <Kpi icon={<Clock className="size-4" />} label="Latência média" value={`${kpis.avg} ms`} />
      </div>

      {/* Filtro */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por agente, modelo, texto, erro..."
          className="pl-9"
        />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* Lista */}
        <div className="rounded-2xl border border-border bg-card/30 divide-y divide-border max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem logs no filtro atual.</p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className={`w-full text-left p-3 hover:bg-secondary/40 transition ${active?.id === r.id ? "bg-secondary/60" : ""}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {r.ok ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <CheckCircle2 className="size-3" /> OK
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertCircle className="size-3" /> ERR
                    </Badge>
                  )}
                  <span className="text-xs font-medium">{r.agentName || "—"}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.model}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {r.latencyMs} ms · {new Date(r.createdAt).toLocaleTimeString("pt-BR")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{r.userText}</div>
              </button>
            ))
          )}
        </div>

        {/* Detalhe */}
        <div className="rounded-2xl border border-border bg-card/30 p-5 max-h-[70vh] overflow-y-auto">
          {!active ? (
            <p className="text-sm text-muted-foreground">
              Selecione um log para ver o trace completo.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                {active.ok ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="size-3" /> Sucesso
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="size-3" /> Erro
                  </Badge>
                )}
                <Badge variant="outline">{active.providerKind}</Badge>
                <Badge variant="outline">{active.model}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{active.latencyMs} ms</span>
              </div>

              <Field label="Agente">
                {active.agentName} <span className="text-muted-foreground">({active.agentId})</span>
              </Field>
              <Field label="Instância">
                {active.instanceName} ·{" "}
                <span className="font-mono text-xs">{active.remoteJid}</span>
              </Field>
              <Field label="Conversa">{active.conversationId}</Field>
              <Field label="System prompt">
                <span className="text-muted-foreground">{active.systemPromptChars} chars</span>
              </Field>
              <Field label="Mensagem do usuário">
                <pre className="whitespace-pre-wrap break-words text-xs bg-secondary/40 p-3 rounded-lg">
                  {active.userText}
                </pre>
              </Field>
              <Field label="Resposta da IA">
                <pre className="whitespace-pre-wrap break-words text-xs bg-secondary/40 p-3 rounded-lg">
                  {active.reply || "—"}
                </pre>
              </Field>
              {active.error && (
                <Field label="Erro">
                  <pre className="whitespace-pre-wrap break-words text-xs bg-destructive/10 text-destructive p-3 rounded-lg">
                    {active.error}
                  </pre>
                </Field>
              )}
              <Field label="Quando">{new Date(active.createdAt).toLocaleString("pt-BR")}</Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-bold">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
