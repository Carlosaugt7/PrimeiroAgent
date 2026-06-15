import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRightCircle,
  Building2,
  Crown,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Edit,
  Trash,
  Calendar,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/master")({
  head: () => ({ meta: [{ title: "Master Admin — AgentFlow IA" }] }),
  component: Master,
});

interface TenantRow {
  id: string;
  name?: string;
  ownerId?: string;
  plan?: string;
  status?: string;
  createdAt?: string;
  planExpiresAt?: string;
  maxAgents?: number | null;
  maxMessages?: number | null;
  maxInstances?: number | null;
  enabledFeatures?: string[] | null;
  phone?: string | null;
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

  // Estados do Modal de Planos
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);
  const [modalPlan, setModalPlan] = useState<string>("trial");
  const [modalStatus, setModalStatus] = useState<string>("active");
  const [modalExpiresAt, setModalExpiresAt] = useState<string>("");
  const [modalMaxAgents, setModalMaxAgents] = useState<string>("");
  const [modalMaxMessages, setModalMaxMessages] = useState<string>("");
  const [modalMaxInstances, setModalMaxInstances] = useState<string>("");
  const [modalFeatures, setModalFeatures] = useState<string[]>([]);
  const [modalPhone, setModalPhone] = useState<string>("");
  const [savingPlan, setSavingPlan] = useState(false);

  const formatPhone = (value: string) => {
    if (!value) return "";
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 6) return `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
    return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7, 11)}`;
  };

  const openPlanModal = (t: TenantRow) => {
    setSelectedTenant(t);
    setModalPlan(t.plan || "trial");
    setModalStatus(t.status || "active");
    setModalExpiresAt(t.planExpiresAt ? new Date(t.planExpiresAt).toISOString().split("T")[0] : "");
    setModalMaxAgents(t.maxAgents !== null && t.maxAgents !== undefined ? t.maxAgents.toString() : "");
    setModalMaxMessages(t.maxMessages !== null && t.maxMessages !== undefined ? t.maxMessages.toString() : "");
    setModalMaxInstances(t.maxInstances !== null && t.maxInstances !== undefined ? t.maxInstances.toString() : "");
    setModalFeatures(t.enabledFeatures || []);
    setModalPhone(t.phone || "");
  };

  const handleFeatureToggle = (feature: string) => {
    setModalFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const renewPlan30Days = () => {
    const currentExpiry = modalExpiresAt ? new Date(modalExpiresAt + "T23:59:59") : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    setModalExpiresAt(newExpiry.toISOString().split("T")[0]);
    setModalStatus("active");
    toast.success("Plano renovado por +30 dias!");
  };

  const savePlanChanges = async () => {
    if (!selectedTenant) return;
    setSavingPlan(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          plan: modalPlan,
          status: modalStatus,
          planExpiresAt: modalExpiresAt ? new Date(modalExpiresAt + "T23:59:59Z").toISOString() : null,
          maxAgents: modalMaxAgents ? parseInt(modalMaxAgents) : null,
          maxMessages: modalMaxMessages ? parseInt(modalMaxMessages) : null,
          maxInstances: modalMaxInstances ? parseInt(modalMaxInstances) : null,
          enabledFeatures: modalFeatures,
          phone: modalPhone || null,
        })
        .eq("id", selectedTenant.id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedTenant.id
            ? {
                ...r,
                plan: modalPlan,
                status: modalStatus,
                planExpiresAt: modalExpiresAt ? new Date(modalExpiresAt + "T23:59:59Z").toISOString() : undefined,
                maxAgents: modalMaxAgents ? parseInt(modalMaxAgents) : null,
                maxMessages: modalMaxMessages ? parseInt(modalMaxMessages) : null,
                maxInstances: modalMaxInstances ? parseInt(modalMaxInstances) : null,
                enabledFeatures: modalFeatures,
                phone: modalPhone || null,
              }
            : r
        )
      );

      toast.success("Plano e limites do cliente salvos com sucesso!");
      setSelectedTenant(null);
    } catch (e) {
      toast.error(`Falha ao salvar plano: ${messageFromError(e, "erro desconhecido")}`);
    } finally {
      setSavingPlan(false);
    }
  };

  useEffect(() => {
    if (!isMaster) return;
    (async () => {
      try {
        const { data, error } = await supabase.from("tenants").select("*");
        if (error) throw error;
        setRows((data as TenantRow[]) || []);
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

  const getSupabaseToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const editTenant = async (id: string, currentName?: string) => {
    const newName = window.prompt("Novo nome do cliente (workspace):", currentName || "");
    if (!newName || newName === currentName) return;
    try {
      const { error } = await supabase.from("tenants").update({ name: newName }).eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: newName } : r)));
      toast.success("Workspace atualizada com sucesso");
    } catch (e) {
      toast.error(messageFromError(e, "Falha ao atualizar"));
    }
  };

  const deleteTenant = async (id: string, name?: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a workspace ${name || id}?\nEsta ação não pode ser desfeita e excluirá todos os dados atrelados.`)) return;
    try {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Workspace excluída com sucesso");
    } catch (e) {
      toast.error(messageFromError(e, "Falha ao excluir"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Crown className="size-7 text-amber-500" /> Master Admin
          </h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-1 flex-wrap text-sm">
            Logado como <span className="font-medium text-foreground">{user?.email}</span>.
            Workspace ativo:{" "}
            <Badge variant="outline" className="ml-1">
              {tenant?.name ?? "—"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={async () => {
              const name = window.prompt("Nome do cliente (workspace):");
              if (!name) return;
              try {
                const idToken = await getSupabaseToken();
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
            <div key={t.id} className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors">
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
                <div className="text-xs text-muted-foreground font-mono truncate mt-1">
                  ID: {t.id} · owner: {t.ownerId ?? "—"}
                  {t.phone && ` · cel: ${t.phone}`}
                  {t.planExpiresAt && ` · expira: ${new Date(t.planExpiresAt).toLocaleDateString("pt-BR")}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => editTenant(t.id, t.name)} title="Editar workspace">
                  <Edit className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteTenant(t.id, t.name)} title="Excluir workspace">
                  <Trash className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-amber-500 hover:text-amber-600" onClick={() => openPlanModal(t)} title="Gerenciar plano e limites">
                  <Crown className="size-4" />
                </Button>
                <div className="w-[1px] h-6 bg-border mx-1" />
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

      {selectedTenant && (
        <Dialog open={!!selectedTenant} onOpenChange={(o) => !o && setSelectedTenant(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="size-5 text-amber-500" />
                Gerenciar Plano: {selectedTenant.name || selectedTenant.id}
              </DialogTitle>
              <DialogDescription>
                Configure as datas, status, limites e permissões/serviços adicionais para este cliente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 my-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Seleção do Plano */}
                <div>
                  <Label htmlFor="m-plan" className="text-xs font-semibold">Plano da Workspace</Label>
                  <select
                    id="m-plan"
                    value={modalPlan}
                    onChange={(e) => setModalPlan(e.target.value)}
                    className="w-full h-10 mt-1.5 rounded-lg bg-secondary border border-border text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Seleção do Status */}
                <div>
                  <Label htmlFor="m-status" className="text-xs font-semibold">Status do Cliente</Label>
                  <select
                    id="m-status"
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    className="w-full h-10 mt-1.5 rounded-lg bg-secondary border border-border text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="active">Ativo (Permite uso)</option>
                    <option value="suspended">Suspenso (Bloqueia tudo)</option>
                  </select>
                </div>
              </div>

              {/* Celular do Cliente */}
              <div>
                <Label htmlFor="m-phone" className="text-xs font-semibold">Celular do Cliente (Dono)</Label>
                <Input
                  id="m-phone"
                  value={modalPhone}
                  onChange={(e) => setModalPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="mt-1.5"
                  maxLength={15}
                />
              </div>

              {/* Expiração do Plano & Renovação */}
              <div className="border border-border bg-muted/20 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Calendar className="size-4 text-muted-foreground" />
                    Data de Expiração / Validade do Plano
                  </Label>
                  <Button size="sm" variant="hero" onClick={renewPlan30Days}>
                    🔄 Confirmar Renovação (+30 dias)
                  </Button>
                </div>
                <Input
                  type="date"
                  value={modalExpiresAt}
                  onChange={(e) => setModalExpiresAt(e.target.value)}
                  className="w-full mt-1"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se a data atual for posterior à data de expiração, a workspace do cliente será bloqueada automaticamente.
                </p>
              </div>

              {/* Limites Customizados (Overrides) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold border-b border-border pb-1">Limites Customizados (Vazio usa o padrão do plano)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="m-agents" className="text-xs">Máx. Agentes</Label>
                    <Input
                      id="m-agents"
                      type="number"
                      placeholder="Padrão"
                      value={modalMaxAgents}
                      onChange={(e) => setModalMaxAgents(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="m-messages" className="text-xs">Máx. Mensagens</Label>
                    <Input
                      id="m-messages"
                      type="number"
                      placeholder="Padrão"
                      value={modalMaxMessages}
                      onChange={(e) => setModalMaxMessages(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="m-instances" className="text-xs">Máx. Instâncias</Label>
                    <Input
                      id="m-instances"
                      type="number"
                      placeholder="Padrão"
                      value={modalMaxInstances}
                      onChange={(e) => setModalMaxInstances(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Habilitar / Desabilitar Serviços adicionais */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold border-b border-border pb-1">Habilitar / Desabilitar Serviços e Módulos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "campaigns_csv", label: "Campanhas por CSV" },
                    { key: "templates_unlimited", label: "Templates Ilimitados" },
                    { key: "contact_extractor", label: "Extrator de Contatos (Agenda/Grupos)" },
                    { key: "export_csv_excel", label: "Exportação nativa CSV/Excel" },
                    { key: "advanced_automations_api", label: "Automações avançadas + API" },
                    { key: "anti_ban", label: "Anti-Ban (Digitação por API)" },
                  ].map((feat) => {
                    const isChecked = modalFeatures.includes(feat.key);
                    return (
                      <label key={feat.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card/20 hover:bg-muted/50 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleFeatureToggle(feat.key)}
                          className="size-4 rounded border-gray-300 text-primary focus:ring-primary accent-accent"
                        />
                        <span className="text-xs font-medium text-foreground">{feat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedTenant(null)} disabled={savingPlan}>
                Cancelar
              </Button>
              <Button onClick={savePlanChanges} disabled={savingPlan}>
                {savingPlan ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
