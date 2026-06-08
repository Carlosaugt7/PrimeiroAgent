import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowRightCircle,
  Building2,
  Crown,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/master")({
  head: () => ({ meta: [{ title: "Master Admin — AgentHub AI" }] }),
  component: Master,
});

interface TenantRow {
  id: string;
  name?: string;
  ownerId?: string;
  plan?: string;
  status?: string;
  createdAt?: string;
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Master() {
  const { isMaster, tenant, switchTenant, resetTenant, user, profile } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMaster) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "tenants"));
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as TenantRow[]);
      } catch (error) {
        toast.error(`Erro ao listar tenants: ${messageFromError(error, "falha desconhecida")}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [isMaster]);

  if (!isMaster) {
    return (
      <div className="rounded-2xl border border-border bg-card/30 p-10 text-center">
        <ShieldAlert className="size-12 mx-auto text-destructive mb-3" />
        <h1 className="font-display text-2xl font-bold">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">
          Esta área é exclusiva de Master Admins da plataforma.
        </p>
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase();
    return !q || r.id.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q);
  });

  const enter = async (id: string) => {
    try {
      await switchTenant(id);
      toast.success("Workspace ativo trocado");
      nav({ to: "/app" });
    } catch (error) {
      toast.error(messageFromError(error, "Falha ao trocar"));
    }
  };

  const openInstances = async (id: string) => {
    try {
      if (tenant?.id !== id) await switchTenant(id);
      toast.success("Abrindo instâncias do cliente");
      nav({ to: "/app/whatsapp" });
    } catch (error) {
      toast.error(messageFromError(error, "Falha ao abrir instâncias"));
    }
  };

  const back = async () => {
    await resetTenant();
    toast.success("Voltou ao seu workspace");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Crown className="size-7 text-amber-500" /> Master Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Logado como <span className="font-medium text-foreground">{user?.email}</span>.
            Workspace ativo:{" "}
            <Badge variant="outline" className="ml-1">
              {tenant?.name ?? "—"}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={async () => {
              const name = window.prompt("Nome do cliente (workspace):");
              if (!name) return;
              try {
                const idToken = await user?.getIdToken(true);
                if (!idToken) throw new Error("Sem sessão");
                const { createTenantAsMaster } = await import("@/lib/master.functions");
                const res = await createTenantAsMaster({ data: { idToken, name } });
                toast.success(`Cliente criado: ${res.name}`);
                setTimeout(() => window.location.reload(), 600);
              } catch (e) {
                toast.error(messageFromError(e, "Falha ao criar cliente"));
              }
            }}
          >
            <Plus className="size-4" /> Novo cliente
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const idToken = await user?.getIdToken(true);
                if (!idToken) throw new Error("Sem sessão");
                const { promoteSelfToMaster } = await import("@/lib/master.functions");
                const res = await promoteSelfToMaster({ data: { idToken } });
                toast.success(`Promovido: ${res.email}. Recarregando...`);
                setTimeout(() => window.location.reload(), 800);
              } catch (e) {
                toast.error(messageFromError(e, "Falha ao promover"));
              }
            }}
          >
            <Crown className="size-4" /> Promover-me a Master
          </Button>
          {tenant?.id !== profile?.tenantId && (
            <Button variant="outline" onClick={back}>
              <RefreshCw className="size-4" /> Voltar ao meu workspace
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nome ou ID..."
          className="pl-9"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card/30 divide-y divide-border">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando tenants...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum tenant encontrado.</p>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-secondary flex items-center justify-center">
                <Building2 className="size-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {t.name || t.id}
                  {tenant?.id === t.id && (
                    <Badge variant="secondary" className="text-[10px]">
                      ativo
                    </Badge>
                  )}
                  {t.plan && (
                    <Badge variant="outline" className="text-[10px]">
                      {t.plan}
                    </Badge>
                  )}
                  {t.status && (
                    <Badge variant="outline" className="text-[10px]">
                      {t.status}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {t.id} · owner: {t.ownerId ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openInstances(t.id)}>
                  <Smartphone className="size-4" /> Instâncias
                </Button>
                <Button size="sm" onClick={() => enter(t.id)} disabled={tenant?.id === t.id}>
                  <ArrowRightCircle className="size-4" /> Entrar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Total: {rows.length} tenant{rows.length !== 1 && "s"}.
      </p>
    </div>
  );
}
