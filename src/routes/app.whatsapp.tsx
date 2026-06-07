import { createFileRoute } from "@tanstack/react-router";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Plus, RefreshCw, QrCode, LogOut, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listInstances, createInstance, connectInstance, instanceState,
  restartInstance, logoutInstance, deleteInstance,
} from "@/lib/evolution.functions";

export const Route = createFileRoute("/app/whatsapp")({ component: Page });

type Inst = { instanceName: string; status: string; ownerJid: string | null; profileName: string | null };

function statusBadge(state: string) {
  const s = state.toLowerCase();
  if (s === "open" || s === "online" || s === "connected")
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Conectado</Badge>;
  if (s === "connecting" || s === "qr")
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Conectando</Badge>;
  return <Badge variant="outline">{state}</Badge>;
}

function Page() {
  const list = useServerFn(listInstances);
  const create = useServerFn(createInstance);
  const connect = useServerFn(connectInstance);
  const state = useServerFn(instanceState);
  const restart = useServerFn(restartInstance);
  const logout = useServerFn(logoutInstance);
  const del = useServerFn(deleteInstance);

  const [instances, setInstances] = useState<Inst[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setInstances(await list()); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao listar"); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Poll QR state while modal open
  useEffect(() => {
    if (!qrFor) return;
    const iv = setInterval(async () => {
      try {
        const r = await state({ data: { instanceName: qrFor } });
        if (r.state.toLowerCase() === "open") {
          toast.success("WhatsApp conectado!");
          setQrFor(null); setQrBase64(null); refresh();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [qrFor, state]);

  const handleCreate = async () => {
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(newName)) { toast.error("Nome inválido"); return; }
    setCreating(true);
    try {
      await create({ data: { instanceName: newName } });
      toast.success("Instância criada");
      setOpenCreate(false); setNewName(""); await refresh();
      // auto open QR
      openQr(newName);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao criar"); }
    finally { setCreating(false); }
  };

  const openQr = async (name: string) => {
    setQrFor(name); setQrBase64(null); setQrLoading(true);
    try {
      const r = await connect({ data: { instanceName: name } });
      setQrBase64(r.base64);
    } catch (e: any) { toast.error(e?.message ?? "Falha no QR"); }
    finally { setQrLoading(false); }
  };

  const handleRestart = async (name: string) => {
    try { await restart({ data: { instanceName: name } }); toast.success("Reiniciada"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };
  const handleLogout = async (name: string) => {
    if (!confirm(`Desconectar ${name}?`)) return;
    try { await logout({ data: { instanceName: name } }); toast.success("Desconectada"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };
  const handleDelete = async (name: string) => {
    if (!confirm(`Excluir definitivamente ${name}?`)) return;
    try { await del({ data: { instanceName: name } }); toast.success("Excluída"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">WhatsApp Cloud Center</h1>
          <p className="text-muted-foreground mt-1">Gerencie instâncias via Evolution API · <span className="font-mono text-xs">evolution-api.rsconsultoria.pro</span></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><Plus className="size-4" /> Nova instância</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar instância WhatsApp</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Nome (identificador único)</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: vendas-loja-1" />
                  <p className="text-xs text-muted-foreground">3–40 caracteres. Apenas letras, números, _ e -.</p>
                </div>
                <Button variant="hero" className="w-full" onClick={handleCreate} disabled={creating}>
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
          <p className="text-sm text-muted-foreground mt-1">Crie sua primeira instância para começar a atender no WhatsApp.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((i) => (
            <div key={i.instanceName} className="rounded-2xl bg-gradient-card border border-border p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{i.instanceName}</p>
                  <p className="text-xs text-muted-foreground truncate">{i.profileName ?? i.ownerJid ?? "—"}</p>
                </div>
                {statusBadge(i.status)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openQr(i.instanceName)}><QrCode className="size-3.5" /> QR</Button>
                <Button size="sm" variant="outline" onClick={() => handleRestart(i.instanceName)}><RefreshCw className="size-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => handleLogout(i.instanceName)}><LogOut className="size-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(i.instanceName)}><Trash2 className="size-3.5 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!qrFor} onOpenChange={(o) => { if (!o) { setQrFor(null); setQrBase64(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar: {qrFor}</DialogTitle></DialogHeader>
          <div className="py-3 text-center space-y-3">
            {qrLoading || !qrBase64 ? (
              <div className="h-64 grid place-items-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <img src={qrBase64} alt="QR Code WhatsApp" className="mx-auto rounded-lg bg-white p-2 max-w-[280px]" />
            )}
            <p className="text-xs text-muted-foreground">Abra o WhatsApp → Aparelhos conectados → Escaneie o QR Code.</p>
            <Button variant="outline" size="sm" onClick={() => qrFor && openQr(qrFor)} disabled={qrLoading}>
              <RefreshCw className="size-3.5" /> Gerar novo QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
