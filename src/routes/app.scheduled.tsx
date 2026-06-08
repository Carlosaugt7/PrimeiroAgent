import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, CalendarClock, Send, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/scheduled")({
  head: () => ({ meta: [{ title: "Agendamentos — AgentHub AI" }] }),
  component: Scheduled,
});

interface ScheduledItem {
  id: string;
  instanceName: string;
  number: string;
  text: string;
  scheduledAt: string;
  status: "pending" | "sent" | "failed";
  sentAt?: string;
  error?: string;
  createdBy?: string;
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function Scheduled() {
  const { tenant, profile } = useAuth();
  const { instances } = useAppStore();

  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [instanceName, setInstanceName] = useState<string>("");
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const defaultWhen = useMemo(
    () => toLocalInputValue(new Date(Date.now() + 15 * 60000).toISOString()),
    [],
  );
  const [when, setWhen] = useState<string>(defaultWhen);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;

    const fetchScheduled = async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("scheduledAt", { ascending: true });

      if (error) {
        console.warn("[scheduled]", error);
      } else if (data) {
        setItems(data as ScheduledItem[]);
      }
    };

    fetchScheduled();

    const channel = supabase
      .channel("public:scheduled_messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_messages",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchScheduled,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  const create = async () => {
    if (!tenant) return;
    if (!instanceName) return toast.error("Selecione uma instância");
    const num = number.trim().replace(/\D/g, "");
    if (num.length < 10)
      return toast.error("Número inválido (use DDI+DDD+número, ex: 5511999999999)");
    if (!text.trim()) return toast.error("Mensagem vazia");
    const at = new Date(when);
    if (isNaN(at.getTime())) return toast.error("Data inválida");
    if (at.getTime() < Date.now() - 60000) return toast.error("Escolha uma data no futuro");

    setSaving(true);
    try {
      const { error } = await supabase.from("scheduled_messages").insert({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        instanceName,
        number: num,
        text: text.trim(),
        scheduledAt: at.toISOString(),
        status: "pending",
      });

      if (error) throw error;

      toast.success("Agendado!");
      setText("");
      setNumber("");
      setWhen(toLocalInputValue(new Date(Date.now() + 15 * 60000).toISOString()));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao agendar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!tenant) return;
    if (!confirm("Excluir agendamento?")) return;
    const { error } = await supabase.from("scheduled_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Agendamento excluído");
  };

  const statusBadge = (s: ScheduledItem["status"]) => {
    if (s === "sent")
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="size-3" /> Enviado
        </Badge>
      );
    if (s === "failed")
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" /> Falhou
        </Badge>
      );
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="size-3" /> Pendente
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Agendamentos</h1>
        <p className="text-muted-foreground mt-1">
          Envio futuro de mensagens via WhatsApp. Um cron processa pendências automaticamente.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5">
        {/* Form */}
        <div className="rounded-2xl border border-border bg-card/30 p-5 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <CalendarClock className="size-4" /> Novo agendamento
          </h2>

          <div>
            <Label className="text-xs">Instância</Label>
            <Select value={instanceName} onValueChange={setInstanceName}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {instances.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    Nenhuma instância conectada
                  </div>
                ) : (
                  instances.map((i) => (
                    <SelectItem key={i.id} value={i.name}>
                      {i.name} · {i.status}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Número (com DDI)</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="5511999999999"
              />
            </div>
            <div>
              <Label className="text-xs">Data/hora de envio</Label>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Olá! Lembrando do nosso compromisso amanhã às 14h."
            />
          </div>

          <Button onClick={create} disabled={saving}>
            <Send className="size-4" /> {saving ? "Agendando..." : "Agendar"}
          </Button>
        </div>

        {/* Lista */}
        <div className="rounded-2xl border border-border bg-card/30 p-5">
          <h2 className="font-semibold text-sm mb-3">Fila ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((m) => (
                <li key={m.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {statusBadge(m.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.scheduledAt).toLocaleString("pt-BR")}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {m.instanceName}
                      </Badge>
                      <span className="text-xs font-mono">{m.number}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words line-clamp-2">{m.text}</p>
                    {m.error && <p className="text-xs text-destructive mt-1">{m.error}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Como o cron funciona</p>
        <p>
          Configure um serviço externo (cron-job.org, GitHub Actions, EasyCron) para chamar a cada
          minuto:
        </p>
        <code className="mt-1 block bg-secondary/60 rounded p-2 break-all">
          GET https://&lt;seu-dominio&gt;/api/public/cron-send?key=$CRON_SECRET
        </code>
        <p className="mt-1">
          Defina o segredo <code>CRON_SECRET</code> nas variáveis do servidor.
        </p>
      </div>
    </div>
  );
}
