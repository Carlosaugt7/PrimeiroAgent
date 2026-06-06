import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore, type LogEntry } from "@/lib/app-store";
import { Activity, AlertTriangle, Info, Wrench, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/logs")({
  component: LogsPage,
});

const levelMap: Record<LogEntry["level"], { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: "text-muted-foreground", label: "info" },
  warn: { icon: AlertTriangle, cls: "text-accent", label: "warn" },
  error: { icon: XCircle, cls: "text-destructive", label: "error" },
  tool: { icon: Wrench, cls: "text-primary", label: "tool" },
};

function LogsPage() {
  const { logs, agents } = useAppStore();
  const [agentId, setAgentId] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");

  const filtered = logs.filter((l) =>
    (agentId === "all" || l.agentId === agentId) &&
    (level === "all" || l.level === level),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Logs & Traces</h1>
          <p className="text-muted-foreground mt-1">Acompanhe execuções, tool calls e erros em tempo real — substitui o <code>tail -f</code> do terminal.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-success"><Activity className="size-3 animate-pulse" /> stream ao vivo</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
          <option value="all">Todos agentes</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
          <option value="all">Todos níveis</option>
          <option value="info">info</option>
          <option value="tool">tool</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto divide-y divide-border font-mono text-xs">
          {filtered.map((l) => {
            const meta = levelMap[l.level];
            const agent = agents.find((a) => a.id === l.agentId);
            return (
              <div key={l.id} className="flex items-start gap-3 px-5 py-2.5 hover:bg-secondary/40">
                <span className="text-muted-foreground w-12 shrink-0">{l.ts}</span>
                <span className={cn("inline-flex items-center gap-1 w-16 shrink-0", meta.cls)}>
                  <meta.icon className="size-3" /> {meta.label}
                </span>
                <span className="text-muted-foreground w-44 shrink-0 truncate">{agent?.name ?? l.agentId}</span>
                <span className="flex-1 text-foreground">{l.message}</span>
                {l.tokens !== undefined && <span className="text-muted-foreground">{l.tokens}tk</span>}
                {l.durationMs !== undefined && <span className="text-muted-foreground">{l.durationMs}ms</span>}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum log para os filtros selecionados.</p>}
        </div>
      </div>
    </div>
  );
}
