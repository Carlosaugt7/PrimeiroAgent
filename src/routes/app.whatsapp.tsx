import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  LogOut,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectInstance,
  createInstance,
  deleteInstance,
  instanceState,
  listInstances,
  logoutInstance,
  restartInstance,
  setWebhook,
} from "@/lib/evolution.functions";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/app-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/whatsapp")({ component: Page });

type Inst = {
  instanceName: string;
  status: string;
  ownerJid: string | null;
  profileName: string | null;
};

type LocalInst = { id: string; instanceName: string; status?: string };

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusBadge(state: string) {
  const s = state.toLowerCase();
  if (s === "open" || s === "online" || s === "connected") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Conectado</Badge>
    );
  }
  if (s === "connecting" || s === "qr") {
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Conectando</Badge>;
  }
  return <Badge variant="outline">{state}</Badge>;
}

function Page() {
  const { tenant, isMaster } = useAuth();
  const { openQr } = useAppStore();
  const list = useServerFn(listInstances);
  const create = useServerFn(createInstance);
  const connect = useServerFn(connectInstance);
  const state = useServerFn(instanceState);
  const restart = useServerFn(restartInstance);
  const logout = useServerFn(logoutInstance);
  const del = useServerFn(deleteInstance);
  const webhook = useServerFn(setWebhook);

  const [instances, setInstances] = useState<Inst[]>([]);
  const [localInstances, setLocalInstances] = useState<LocalInst[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const remote = await list({ data: { tenantId: tenant.id } });
      const remoteByName = new Map(
        remote.filter((i) => i.instanceName).map((i) => [i.instanceName, i]),
      );
      setInstances(
        localInstances.map((i) => {
          return (
            remoteByName.get(i.instanceName) ?? {
              instanceName: i.instanceName,
              status: i.status ?? "registrada",
              ownerJid: null,
              profileName: null,
            }
          );
        }),
      );
    } catch (error) {
      toast.error(messageFromError(error, "Falha ao listar"));
    } finally {
      setLoading(false);
    }
  }, [list, localInstances, tenant]);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);

    const fetchInstances = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .eq("tenantId", tenant.id);

      if (error) {
        toast.error(messageFromError(error, "Falha ao carregar instâncias do workspace"));
        setLoading(false);
      } else if (data) {
        setLocalInstances(
          data.map((d: { id: string; name: string | null; status: string | null }) => ({
            id: d.id,
            instanceName: d.name ?? d.id,
            status: d.status ?? undefined,
          })),
        );
      }
    };

    fetchInstances();

    const channel = supabase
      .channel("public:instances")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "instances",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchInstances,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A verificação periódica de conexão e a geração de QR Code agora são tratadas globalmente na app-store

  const handleCreate = async () => {
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(newName)) {
      toast.error("Nome inválido");
      return;
    }
    if (!tenant) {
      toast.error("Tenant não carregado");
      return;
    }
    const { ensureLimit } = await import("@/lib/limits");
    const lim = ensureLimit(tenant.id, tenant.plan, "instances", instances.length, isMaster);
    if (!lim.ok) {
      toast.error(lim.message ?? "Limite de instâncias atingido");
      return;
    }
    setCreating(true);
    try {
      const publicUrl = import.meta.env.VITE_PUBLIC_URL || globalThis.location.origin;
      const webhookUrl = `${publicUrl}/api/public/evolution-webhook`;
      await create({ data: { tenantId: tenant.id, instanceName: newName, webhookUrl } });

      const { error: idxErr } = await supabase.from("instance_index").insert({
        instanceName: newName,
        tenantId: tenant.id,
      });
      if (idxErr) throw idxErr;

      const { error: instErr } = await supabase.from("instances").insert({
        id: newName,
        tenantId: tenant.id,
        name: newName,
        status: "conectando",
      });
      if (instErr) throw instErr;

      toast.success("Instância criada");
      setOpenCreate(false);
      setNewName("");
      await refresh();
      openQr(newName);
    } catch (error) {
      toast.error(messageFromError(error, "Falha ao criar"));
    } finally {
      setCreating(false);
    }
  };

  const handleSetWebhook = async (name: string) => {
    try {
      const publicUrl = import.meta.env.VITE_PUBLIC_URL || globalThis.location.origin;
      const webhookUrl = `${publicUrl}/api/public/evolution-webhook`;
      await webhook({ data: { tenantId: tenant?.id || "", instanceName: name, webhookUrl } });
      toast.success("Webhook configurado! O agente agora receberá mensagens desta instância.");
    } catch (error) {
      toast.error(messageFromError(error, "Falha ao configurar webhook"));
    }
  };

  const handleRestart = async (name: string) => {
    try {
      await restart({ data: { tenantId: tenant?.id || "", instanceName: name } });
      toast.success("Reiniciada");
      refresh();
    } catch (error) {
      toast.error(messageFromError(error, "Falha"));
    }
  };

  const handleLogout = async (name: string) => {
    if (!confirm(`Desconectar ${name}?`)) return;
    try {
      await logout({ data: { tenantId: tenant?.id || "", instanceName: name } });
      toast.success("Desconectada");
      refresh();
    } catch (error) {
      toast.error(messageFromError(error, "Falha"));
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Excluir definitivamente ${name}?`)) return;
    try {
      try {
        await del({ data: { tenantId: tenant?.id || "", instanceName: name } });
      } catch (evoError) {
        console.warn("Falha ao deletar instância no Evolution API:", evoError);
      }
      if (tenant) {
        await supabase.from("instance_index").delete().eq("instanceName", name);
        await supabase.from("instances").delete().eq("id", name).eq("tenantId", tenant.id);
      }
      toast.success("Excluída");
      refresh();
    } catch (error) {
      toast.error(messageFromError(error, "Falha"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">WhatsApp Cloud Center</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie instâncias via Evolution API ·{" "}
            <span className="font-mono text-xs">evolution-api.rsconsultoria.pro</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm">
                <Plus className="size-4" /> Nova instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar instância WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Nome (identificador único)</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex: vendas-loja-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    3–40 caracteres. Apenas letras, números, _ e -.
                  </p>
                </div>
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : "Criar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading && instances.length === 0 ? (
        <div className="rounded-2xl border border-border p-12 text-center">
          <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
        </div>
      ) : instances.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Smartphone className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma instância</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie sua primeira instância para começar a atender no WhatsApp.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((i) => (
            <div
              key={i.instanceName}
              className="rounded-2xl bg-gradient-card border border-border p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{i.instanceName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {i.profileName ?? i.ownerJid ?? "—"}
                  </p>
                </div>
                {statusBadge(i.status)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openQr(i.instanceName)}>
                  <QrCode className="size-3.5" /> QR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetWebhook(i.instanceName)}
                  title="Configurar Webhook — necessário para o agente receber mensagens"
                >
                  <Webhook className="size-3.5" /> Webhook
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRestart(i.instanceName)}>
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleLogout(i.instanceName)}>
                  <LogOut className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(i.instanceName)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
