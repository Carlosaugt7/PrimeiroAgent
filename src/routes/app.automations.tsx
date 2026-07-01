import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Zap, Tag, PauseCircle, MessageCircle, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/automations")({
  head: () => ({ meta: [{ title: "Automações — Primeiro Agent" }] }),
  component: Automations,
});

type MatchType = "contains" | "equals" | "regex";
type ActionType = "addTag" | "pauseBot" | "reply" | "setStatus";

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  matchType: MatchType;
  pattern: string;
  caseSensitive?: boolean;
  actions: Array<{ type: ActionType; value: string }>;
  order?: number;
}

const emptyDraft = (): Omit<Automation, "id"> => ({
  name: "",
  enabled: true,
  matchType: "contains",
  pattern: "",
  caseSensitive: false,
  actions: [{ type: "addTag", value: "" }],
  order: 0,
});

function Automations() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<Automation[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;

    const fetchAutomations = async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("order", { ascending: true });

      if (error) {
        console.warn("[automations]", error);
      } else if (data) {
        setItems(data as Automation[]);
      }
    };

    fetchAutomations();

    const channel = supabase
      .channel("public:automations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automations",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchAutomations,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  const updateAction = (i: number, patch: Partial<{ type: ActionType; value: string }>) => {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    }));
  };

  const addAction = () =>
    setDraft((d) => ({ ...d, actions: [...d.actions, { type: "addTag", value: "" }] }));

  const removeAction = (i: number) =>
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, idx) => idx !== i) }));

  const create = async () => {
    if (!tenant) return;
    if (!draft.name.trim()) return toast.error("Dê um nome à regra");
    if (!draft.pattern.trim()) return toast.error("Defina o padrão (texto/regex)");
    const cleanActions = draft.actions.filter((a) => a.value.trim() || a.type === "pauseBot");
    if (cleanActions.length === 0) return toast.error("Adicione ao menos uma ação");

    setSaving(true);
    try {
      const { error } = await supabase.from("automations").insert({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        name: draft.name,
        enabled: draft.enabled,
        matchType: draft.matchType,
        pattern: draft.pattern,
        caseSensitive: draft.caseSensitive,
        actions: cleanActions,
        order: items.length,
      });

      if (error) throw error;

      toast.success("Automação criada!");
      setDraft(emptyDraft());
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: Automation) => {
    if (!tenant) return;
    const { error } = await supabase
      .from("automations")
      .update({ enabled: !a.enabled })
      .eq("id", a.id);

    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!tenant) return;
    if (!confirm("Excluir automação?")) return;
    const { error } = await supabase.from("automations").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const actionIcon = (t: ActionType) =>
    t === "addTag" ? (
      <Tag className="size-3" />
    ) : t === "pauseBot" ? (
      <PauseCircle className="size-3" />
    ) : t === "reply" ? (
      <MessageCircle className="size-3" />
    ) : (
      <ArrowRightCircle className="size-3" />
    );

  const actionLabel = (t: ActionType) =>
    ({
      addTag: "Adicionar tag",
      pauseBot: "Pausar bot",
      reply: "Responder",
      setStatus: "Mudar status",
    })[t];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Zap className="size-7 text-primary" /> Automações
        </h1>
        <p className="text-muted-foreground mt-1">
          Regras que rodam quando uma mensagem do contato chega. São avaliadas em ordem, e cada ação
          se aplica antes da resposta da IA.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5">
        {/* Form */}
        <div className="rounded-2xl border border-border bg-card/30 p-5 space-y-3">
          <h2 className="font-semibold text-sm">Nova regra</h2>

          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex: Triagem financeiro"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de match</Label>
              <Select
                value={draft.matchType}
                onValueChange={(v) => setDraft({ ...draft, matchType: v as MatchType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={!!draft.caseSensitive}
                onCheckedChange={(v) => setDraft({ ...draft, caseSensitive: v })}
              />
              <span className="text-xs text-muted-foreground pb-1">Diferenciar maiúsculas</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Padrão</Label>
            <Input
              value={draft.pattern}
              onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
              placeholder="financeiro, boleto, 2ª via"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              "Contém" aceita lista separada por vírgula (qualquer item dispara).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Ações</Label>
            {draft.actions.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={a.type}
                  onValueChange={(v) => updateAction(i, { type: v as ActionType, value: "" })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addTag">Adicionar tag</SelectItem>
                    <SelectItem value="pauseBot">Pausar bot</SelectItem>
                    <SelectItem value="reply">Responder</SelectItem>
                    <SelectItem value="setStatus">Mudar status</SelectItem>
                  </SelectContent>
                </Select>
                {a.type === "pauseBot" ? (
                  <Input disabled value="(sem valor)" />
                ) : a.type === "reply" ? (
                  <Textarea
                    rows={1}
                    className="min-h-10"
                    value={a.value}
                    onChange={(e) => updateAction(i, { value: e.target.value })}
                    placeholder="Resposta automática"
                  />
                ) : a.type === "setStatus" ? (
                  <Select value={a.value} onValueChange={(v) => updateAction(i, { value: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberta">aberta</SelectItem>
                      <SelectItem value="handoff">handoff</SelectItem>
                      <SelectItem value="resolvida">resolvida</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={a.value}
                    onChange={(e) => updateAction(i, { value: e.target.value })}
                    placeholder="nome-da-tag"
                  />
                )}
                <Button size="icon" variant="ghost" onClick={() => removeAction(i)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addAction}>
              <Plus className="size-3" /> Adicionar ação
            </Button>
          </div>

          <Button onClick={create} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Criar automação"}
          </Button>
        </div>

        {/* Lista */}
        <div className="rounded-2xl border border-border bg-card/30 p-5">
          <h2 className="font-semibold text-sm mb-3">Regras ativas ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <Switch checked={a.enabled} onCheckedChange={() => toggle(a)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {a.matchType}
                      </Badge>
                      {a.caseSensitive && (
                        <Badge variant="secondary" className="text-[10px]">
                          Aa
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono break-all">
                      {a.pattern}
                    </div>
                    <div className="flex gap-1 flex-wrap mt-2">
                      {a.actions.map((act, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                          {actionIcon(act.type)} {actionLabel(act.type)}
                          {act.value && (
                            <span className="opacity-70">: {act.value.slice(0, 30)}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
