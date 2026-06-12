import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/templates")({
  head: () => ({ meta: [{ title: "Templates de mensagem — AgentFlow IA" }] }),
  component: Templates,
});

export interface Template {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

function Templates() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<Template[]>([]);
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;

    const fetchTemplates = async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("shortcut", { ascending: true });

      if (error) {
        console.warn("[templates]", error);
      } else if (data) {
        setItems(data as Template[]);
      }
    };

    fetchTemplates();

    const channel = supabase
      .channel("public:templates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "templates",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchTemplates,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  const reset = () => {
    setShortcut("");
    setTitle("");
    setBody("");
    setEditingId(null);
  };

  const save = async () => {
    if (!tenant) return;
    const sc = shortcut.trim().replace(/^\/?/, "").toLowerCase();
    if (!sc || !/^[a-z0-9_-]{1,30}$/.test(sc))
      return toast.error("Atalho inválido (a-z, 0-9, _ -)");
    if (!body.trim()) return toast.error("Mensagem vazia");
    try {
      if (editingId) {
        const { error } = await supabase
          .from("templates")
          .update({
            shortcut: sc,
            title: title.trim() || sc,
            body: body.trim(),
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Template atualizado");
      } else {
        const { error } = await supabase.from("templates").insert({
          id: crypto.randomUUID(),
          tenantId: tenant.id,
          shortcut: sc,
          title: title.trim() || sc,
          body: body.trim(),
        });

        if (error) throw error;
        toast.success("Template criado");
      }
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setShortcut(t.shortcut);
    setTitle(t.title);
    setBody(t.body);
  };

  const remove = async (id: string) => {
    if (!tenant) return;
    if (!confirm("Excluir template?")) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Template excluído");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Templates de mensagem</h1>
        <p className="text-muted-foreground mt-1">
          Respostas rápidas. No Inbox, digite{" "}
          <code className="px-1.5 py-0.5 rounded bg-secondary text-xs">/atalho</code> para inserir.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5">
        <div className="rounded-2xl border border-border bg-card/30 p-5 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquareText className="size-4" />{" "}
            {editingId ? "Editar template" : "Novo template"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Atalho</Label>
              <Input
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="ola"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Será disparado como <code>/{shortcut || "atalho"}</code>
              </p>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Saudação inicial"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Olá! Tudo bem? Em que posso ajudar?"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>
              <Save className="size-4" /> {editingId ? "Atualizar" : "Criar"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/30 p-5">
          <h2 className="font-semibold text-sm mb-3">Templates salvos ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum template ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((t) => (
                <li key={t.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono">
                        /{t.shortcut}
                      </Badge>
                      <span className="text-sm font-medium truncate">{t.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {t.body}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                      Editar
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Sugestão: crie <code>/ola</code>, <code>/precos</code>, <code>/horarios</code>,{" "}
            <code>/endereco</code> para acelerar atendimentos.
          </p>
          <Button
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setShortcut("ola");
              setTitle("Saudação");
              setBody("Olá! Tudo bem? Em que posso ajudar?");
            }}
          >
            <Plus className="size-4" /> Começar com exemplo
          </Button>
        </div>
      )}
    </div>
  );
}
