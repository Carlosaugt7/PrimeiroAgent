import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, ShieldCheck, History } from "lucide-react";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Auditoria — AgentHub AI" }] }),
  component: Page,
});

interface Entry {
  id: string;
  action: string;
  target?: string | null;
  targetLabel?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  meta?: any;
  createdAt?: string;
}

function Page() {
  const { tenant, profile, isMaster } = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");

  const canView = isMaster || profile?.role === "owner" || profile?.role === "admin";

  useEffect(() => {
    if (!tenant?.id || !canView) return;

    const fetchAudit = async () => {
      const { data, error } = await supabase
        .from("audit")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("createdAt", { ascending: false });
      if (error) {
        console.warn("[audit]", error);
      } else if (data) {
        setItems(data as Entry[]);
      }
    };

    fetchAudit();

    const channel = supabase
      .channel("public:audit")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit", filter: `tenantId=eq.${tenant.id}` },
        () => {
          fetchAudit();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, canView]);

  const actions = useMemo(() => Array.from(new Set(items.map((i) => i.action))).sort(), [items]);

  const filtered = items.filter((i) => {
    if (action !== "all" && i.action !== action) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !`${i.action} ${i.targetLabel ?? ""} ${i.target ?? ""} ${i.actorName ?? ""} ${i.actorEmail ?? ""}`
          .toLowerCase()
          .includes(s)
      )
        return false;
    }
    return true;
  });

  const exportCSV = () => {
    const rows = [
      ["Data", "Ação", "Alvo", "Ator", "Email", "Meta"],
      ...filtered.map((i) => [
        i.createdAt ? new Date(i.createdAt).toISOString() : "",
        i.action,
        i.targetLabel ?? i.target ?? "",
        i.actorName ?? "",
        i.actorEmail ?? "",
        i.meta ? JSON.stringify(i.meta) : "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <ShieldCheck className="size-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="font-display text-xl font-bold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas administradores podem visualizar o log de auditoria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <History className="size-7 text-accent" /> Log de auditoria
          </h1>
          <p className="text-muted-foreground mt-1">{items.length} eventos registrados</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-10 px-3 rounded-md bg-secondary/60 border border-border text-sm"
        >
          <option value="all">Todas as ações</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 px-4">Data</th>
              <th className="py-2 px-4">Ação</th>
              <th className="py-2 px-4">Alvo</th>
              <th className="py-2 px-4">Ator</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum evento encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="border-t border-border/40">
                  <td className="py-2 px-4 text-muted-foreground text-xs whitespace-nowrap">
                    {i.createdAt ? new Date(i.createdAt).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-2 px-4 font-mono text-xs">{i.action}</td>
                  <td className="py-2 px-4">{i.targetLabel ?? i.target ?? "—"}</td>
                  <td className="py-2 px-4 text-xs">
                    {i.actorName ?? "—"}
                    {i.actorEmail && (
                      <span className="block text-muted-foreground">{i.actorEmail}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
