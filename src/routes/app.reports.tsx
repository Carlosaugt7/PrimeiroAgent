import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, BarChart3, MessageSquare, Users, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Primeiro Agent" }] }),
  component: Reports,
});

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Reports() {
  const { conversations, instances } = useAppStore();
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(past);
  const [to, setTo] = useState(today);
  const [instanceName, setInstanceName] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const f = new Date(from + "T00:00:00").getTime();
    const t = new Date(to + "T23:59:59").getTime();
    return conversations.filter((c) => {
      const ts = new Date(c.updatedAt).getTime();
      if (isNaN(ts) || ts < f || ts > t) return false;
      if (instanceName !== "all" && c.instanceName !== instanceName) return false;
      if (status !== "all" && c.status !== status) return false;
      return true;
    });
  }, [conversations, from, to, instanceName, status]);

  const kpis = useMemo(() => {
    const uniqueContacts = new Set(filtered.map((c) => c.contactPhone)).size;
    const resolved = filtered.filter((c) => c.status === "resolvida").length;
    const handoff = filtered.filter((c) => c.status === "handoff" || c.botPaused).length;
    return {
      total: filtered.length,
      uniqueContacts,
      resolved,
      handoff,
      resolutionRate: filtered.length ? Math.round((resolved / filtered.length) * 100) : 0,
    };
  }, [filtered]);

  const tagBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => (c.tags ?? []).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [filtered]);

  const exportConversations = () => {
    const header = [
      "id",
      "contato",
      "telefone",
      "instancia",
      "status",
      "tags",
      "atualizado_em",
      "ultima_mensagem",
    ];
    const rows = filtered.map((c) => [
      c.id,
      c.contactName ?? "",
      c.contactPhone ?? "",
      c.instanceName ?? "",
      c.status,
      (c.tags ?? []).join("|"),
      new Date(c.updatedAt).toLocaleString("pt-BR"),
      (c.lastMessage ?? "").replace(/\n/g, " "),
    ]);
    downloadCSV(`conversas_${from}_a_${to}.csv`, [header, ...rows]);
  };

  const exportSummary = () => {
    const rows: (string | number)[][] = [
      ["metrica", "valor"],
      ["periodo_de", from],
      ["periodo_ate", to],
      ["instancia", instanceName],
      ["status_filtro", status],
      ["total_conversas", kpis.total],
      ["contatos_unicos", kpis.uniqueContacts],
      ["resolvidas", kpis.resolved],
      ["handoff_ou_pausadas", kpis.handoff],
      ["taxa_resolucao_pct", kpis.resolutionRate],
      [],
      ["tag", "ocorrencias"],
      ...tagBreakdown,
    ];
    downloadCSV(`relatorio_${from}_a_${to}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Métricas consolidadas e exportações em CSV.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportSummary}>
            <Download className="size-4" /> Resumo
          </Button>
          <Button onClick={exportConversations}>
            <Download className="size-4" /> Conversas
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Instância</Label>
          <Select value={instanceName} onValueChange={setInstanceName}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {instances.map((i) => (
                <SelectItem key={i.id} value={i.name}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="handoff">Handoff</SelectItem>
              <SelectItem value="resolvida">Resolvida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<MessageSquare className="size-4" />} label="Conversas" value={kpis.total} />
        <Kpi
          icon={<Users className="size-4" />}
          label="Contatos únicos"
          value={kpis.uniqueContacts}
        />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Resolvidas" value={kpis.resolved} />
        <Kpi
          icon={<BarChart3 className="size-4" />}
          label="Taxa resolução"
          value={`${kpis.resolutionRate}%`}
        />
      </div>

      {/* Tags */}
      <div className="rounded-2xl border border-border bg-card/30 p-5">
        <h2 className="font-semibold text-sm mb-3">Top tags no período</h2>
        {tagBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem tags no período.</p>
        ) : (
          <ul className="space-y-2">
            {tagBreakdown.map(([tag, n]) => {
              const max = tagBreakdown[0][1];
              const pct = Math.round((n / max) * 100);
              return (
                <li key={tag} className="flex items-center gap-3">
                  <span className="text-xs w-32 truncate">{tag}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{n}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border bg-card/30 p-5 overflow-x-auto">
        <h2 className="font-semibold text-sm mb-3">Conversas no período ({filtered.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2">Contato</th>
              <th className="text-left">Instância</th>
              <th className="text-left">Status</th>
              <th className="text-left">Tags</th>
              <th className="text-left">Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="py-2">
                  <div className="font-medium">{c.contactName || "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.contactPhone}</div>
                </td>
                <td className="text-xs">{c.instanceName ?? "—"}</td>
                <td>
                  <Badge variant="outline" className="text-[10px]">
                    {c.status}
                  </Badge>
                </td>
                <td className="text-xs">{(c.tags ?? []).join(", ") || "—"}</td>
                <td className="text-xs">{new Date(c.updatedAt).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <p className="text-xs text-muted-foreground mt-2">
            Exibindo 100 de {filtered.length}. Use "Exportar Conversas" para o CSV completo.
          </p>
        )}
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
