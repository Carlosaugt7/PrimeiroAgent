import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAppStore, type LLMProvider } from "@/lib/app-store";
import { detectModels } from "@/lib/llm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Cpu, Plus, RefreshCw, Trash2, Loader2, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/llm-providers")({
  component: ProvidersPage,
});

const KIND_LABEL: Record<LLMProvider["kind"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  custom: "Custom (OpenAI-compatível)",
};

const DEFAULT_URLS: Record<LLMProvider["kind"], string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

function ProvidersPage() {
  const { providers, createProvider, updateProvider, deleteProvider } = useAppStore();
  const detect = useServerFn(detectModels);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    kind: LLMProvider["kind"];
    baseUrl: string;
    apiKey: string;
    models: (LLMProvider["models"][number] & { selected?: boolean })[];
  }>({
    name: "",
    kind: "openai",
    baseUrl: DEFAULT_URLS.openai,
    apiKey: "",
    models: [],
  });

  const [refreshingProvider, setRefreshingProvider] = useState<LLMProvider | null>(null);
  const [detectedModelsForRefresh, setDetectedModelsForRefresh] = useState<
    (LLMProvider["models"][number] & { selected?: boolean })[]
  >([]);

  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    kind: LLMProvider["kind"];
    baseUrl: string;
    apiKey: string;
    models: (LLMProvider["models"][number] & { selected?: boolean })[];
  }>({
    name: "",
    kind: "openai",
    baseUrl: "",
    apiKey: "",
    models: [],
  });

  const handleStartEdit = (p: LLMProvider) => {
    setEditingProvider(p);
    setEditForm({
      name: p.name,
      kind: p.kind,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      models: (p.models ?? []).map((m) => ({ ...m, selected: true })),
    });
  };

  const handleEditKind = (k: LLMProvider["kind"]) =>
    setEditForm((f) => ({ ...f, kind: k, baseUrl: DEFAULT_URLS[k] || f.baseUrl }));

  const handleEditDetect = async () => {
    if (!editForm.apiKey) {
      toast.error("Informe a API key");
      return;
    }
    setBusy(true);
    try {
      const r = await detect({
        data: { kind: editForm.kind, baseUrl: editForm.baseUrl, apiKey: editForm.apiKey },
      });
      if (r.error) toast.error(r.error);
      const currentSelectedIds = new Set(
        editForm.models.filter((m) => m.selected !== false).map((m) => m.id),
      );
      const modelsWithSelection = (r.models ?? []).map((m) => ({
        ...m,
        selected: currentSelectedIds.size === 0 || currentSelectedIds.has(m.id),
      }));
      setEditForm((f) => ({ ...f, models: modelsWithSelection }));
      if (r.models.length) toast.success(`${r.models.length} modelos detectados`);
      else if (!r.error) toast.warning("Nenhum modelo retornado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao detectar modelos");
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editingProvider) return;
    if (!editForm.name.trim() || !editForm.apiKey) {
      toast.error("Nome e API key são obrigatórios");
      return;
    }
    setBusy(true);
    try {
      const selectedModels = editForm.models
        .filter((m) => m.selected !== false)
        .map(({ id, contextWindow }) => ({ id, contextWindow }));
      await updateProvider(editingProvider.id, {
        name: editForm.name,
        kind: editForm.kind,
        baseUrl: editForm.baseUrl,
        apiKey: editForm.apiKey,
        models: selectedModels,
      });
      toast.success("Provedor atualizado com sucesso!");
      setEditingProvider(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar provedor");
    } finally {
      setBusy(false);
    }
  };

  const handleKind = (k: LLMProvider["kind"]) =>
    setForm({ ...form, kind: k, baseUrl: DEFAULT_URLS[k] });

  const handleDetect = async () => {
    if (!form.apiKey) {
      toast.error("Informe a API key");
      return;
    }
    setBusy(true);
    try {
      const r = await detect({
        data: { kind: form.kind, baseUrl: form.baseUrl, apiKey: form.apiKey },
      });
      if (r.error) toast.error(r.error);
      const modelsWithSelection = (r.models ?? []).map((m) => ({ ...m, selected: true }));
      setForm((f) => ({ ...f, models: modelsWithSelection }));
      if (r.models.length) toast.success(`${r.models.length} modelos detectados`);
      else if (!r.error) toast.warning("Nenhum modelo retornado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.apiKey) {
      toast.error("Nome e API key obrigatórios");
      return;
    }
    setBusy(true);
    try {
      const selectedModels = form.models
        .filter((m) => m.selected !== false)
        .map(({ id, contextWindow }) => ({ id, contextWindow }));
      await createProvider({
        name: form.name,
        kind: form.kind,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        models: selectedModels,
      });
      toast.success("Provedor cadastrado");
      setOpen(false);
      setForm({ name: "", kind: "openai", baseUrl: DEFAULT_URLS.openai, apiKey: "", models: [] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const handleStartRefresh = async (p: LLMProvider) => {
    setBusy(true);
    try {
      const r = await detect({ data: { kind: p.kind, baseUrl: p.baseUrl, apiKey: p.apiKey } });
      if (r.error) {
        toast.error(r.error);
        return;
      }

      const currentModelIds = new Set((p.models ?? []).map((m) => m.id));
      const modelsWithSelection = (r.models ?? []).map((m) => ({
        ...m,
        selected: currentModelIds.size === 0 || currentModelIds.has(m.id),
      }));

      setDetectedModelsForRefresh(modelsWithSelection);
      setRefreshingProvider(p);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar modelos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Provedores LLM</h1>
          <p className="text-muted-foreground mt-1">
            Cadastre suas chaves de OpenAI, Anthropic, Gemini, Groq, DeepSeek e outros.
          </p>
        </div>
        <Button variant="hero" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Cadastrar provedor
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Cpu className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum provedor cadastrado</p>
          <p className="text-sm text-muted-foreground">
            Cadastre pelo menos um provedor para criar agentes.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="rounded-2xl bg-gradient-card border border-border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{p.name}</h3>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                      {KIND_LABEL[p.kind]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                    {p.baseUrl || "—"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleStartEdit(p)}
                    disabled={busy}
                    className="size-8 grid place-items-center rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                    title="Editar provedor"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleStartRefresh(p)}
                    disabled={busy}
                    className="size-8 grid place-items-center rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                    title="Atualizar modelos"
                  >
                    <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Excluir ${p.name}?`)) {
                        await deleteProvider(p.id);
                        toast.success("Excluído");
                      }
                    }}
                    className="size-8 grid place-items-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  {p.models.length} modelos disponíveis
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {p.models.slice(0, 20).map((m) => (
                    <span
                      key={m.id}
                      className="text-[10px] px-2 py-1 rounded bg-secondary font-mono"
                    >
                      {m.id}
                    </span>
                  ))}
                  {p.models.length > 20 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{p.models.length - 20}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar provedor LLM</DialogTitle>
            <DialogDescription>
              Informe a URL e a chave. Detectamos os modelos disponíveis automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nome interno</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: OpenAI Produção"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Provedor</Label>
              <Select value={form.kind} onValueChange={(v) => handleKind(v as LLMProvider["kind"])}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base URL</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <Button variant="outline" onClick={handleDetect} disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="animate-spin size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Detectar modelos
            </Button>

            {form.models.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-success flex items-center gap-1.5">
                    <CheckCircle2 className="size-3" /> {form.models.length} modelos detectados
                  </p>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          models: f.models.map((m) => ({ ...m, selected: true })),
                        }))
                      }
                      className="text-primary hover:underline font-medium"
                    >
                      Selecionar todos
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          models: f.models.map((m) => ({ ...m, selected: false })),
                        }))
                      }
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {form.models.map((m, idx) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-mono cursor-pointer transition-colors ${
                        m.selected !== false
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={m.selected !== false}
                        onChange={(e) => {
                          const updated = [...form.models];
                          updated[idx] = { ...updated[idx], selected: e.target.checked };
                          setForm({ ...form, models: updated });
                        }}
                        className="rounded border-border text-primary focus:ring-primary size-3.5"
                      />
                      <span className="truncate" title={m.id}>
                        {m.id}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={submit} disabled={busy}>
              Salvar provedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!refreshingProvider}
        onOpenChange={(open) => {
          if (!open) setRefreshingProvider(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atualizar modelos para {refreshingProvider?.name}</DialogTitle>
            <DialogDescription>
              Selecione quais modelos deste provedor você deseja manter disponíveis para os seus
              agentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {detectedModelsForRefresh.length > 0 ? (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-success flex items-center gap-1.5">
                    <CheckCircle2 className="size-3" /> {detectedModelsForRefresh.length} modelos
                    detectados
                  </p>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        setDetectedModelsForRefresh((models) =>
                          models.map((m) => ({ ...m, selected: true })),
                        )
                      }
                      className="text-primary hover:underline font-medium"
                    >
                      Selecionar todos
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDetectedModelsForRefresh((models) =>
                          models.map((m) => ({ ...m, selected: false })),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                  {detectedModelsForRefresh.map((m, idx) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-mono cursor-pointer transition-colors ${
                        m.selected !== false
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={m.selected !== false}
                        onChange={(e) => {
                          const updated = [...detectedModelsForRefresh];
                          updated[idx] = { ...updated[idx], selected: e.target.checked };
                          setDetectedModelsForRefresh(updated);
                        }}
                        className="rounded border-border text-primary focus:ring-primary size-3.5"
                      />
                      <span className="truncate" title={m.id}>
                        {m.id}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum modelo retornado.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefreshingProvider(null)}>
              Cancelar
            </Button>
            <Button
              variant="hero"
              disabled={busy}
              onClick={async () => {
                if (!refreshingProvider) return;
                setBusy(true);
                try {
                  const selectedModels = detectedModelsForRefresh
                    .filter((m) => m.selected !== false)
                    .map(({ id, contextWindow }) => ({ id, contextWindow }));
                  await updateProvider(refreshingProvider.id, { models: selectedModels });
                  toast.success(
                    `Modelos atualizados com sucesso (${selectedModels.length} ativos)`,
                  );
                  setRefreshingProvider(null);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Erro ao atualizar provedor");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE EDIÇÃO DO PROVEDOR */}
      <Dialog
        open={!!editingProvider}
        onOpenChange={(open) => {
          if (!open) setEditingProvider(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar provedor LLM</DialogTitle>
            <DialogDescription>
              Atualize o nome, chave de API, base URL ou a seleção de modelos disponíveis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nome interno</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ex: OpenAI Produção"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Provedor</Label>
              <Select
                value={editForm.kind}
                onValueChange={(v) => handleEditKind(v as LLMProvider["kind"])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base URL</Label>
              <Input
                value={editForm.baseUrl}
                onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={editForm.apiKey}
                onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <Button variant="outline" onClick={handleEditDetect} disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="animate-spin size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Detectar modelos
            </Button>

            {editForm.models.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-success flex items-center gap-1.5">
                    <CheckCircle2 className="size-3" /> {editForm.models.length} modelos na lista
                  </p>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          models: f.models.map((m) => ({ ...m, selected: true })),
                        }))
                      }
                      className="text-primary hover:underline font-medium"
                    >
                      Selecionar todos
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          models: f.models.map((m) => ({ ...m, selected: false })),
                        }))
                      }
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {editForm.models.map((m, idx) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-mono cursor-pointer transition-colors ${
                        m.selected !== false
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={m.selected !== false}
                        onChange={(e) => {
                          const updated = [...editForm.models];
                          updated[idx] = { ...updated[idx], selected: e.target.checked };
                          setEditForm({ ...editForm, models: updated });
                        }}
                        className="rounded border-border text-primary focus:ring-primary size-3.5"
                      />
                      <span className="truncate" title={m.id}>
                        {m.id}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProvider(null)}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={submitEdit} disabled={busy}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
