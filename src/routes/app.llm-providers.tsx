import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAppStore, type LLMProvider } from "@/lib/app-store";
import { detectModels } from "@/lib/llm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Cpu, Plus, RefreshCw, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/llm-providers")({
  component: ProvidersPage,
});

const KIND_LABEL: Record<LLMProvider["kind"], string> = {
  openai: "OpenAI", anthropic: "Anthropic", google: "Google Gemini",
  groq: "Groq", deepseek: "DeepSeek", openrouter: "OpenRouter", custom: "Custom (OpenAI-compatível)",
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
  const [form, setForm] = useState<{ name: string; kind: LLMProvider["kind"]; baseUrl: string; apiKey: string; models: LLMProvider["models"] }>({
    name: "", kind: "openai", baseUrl: DEFAULT_URLS.openai, apiKey: "", models: [],
  });

  const handleKind = (k: LLMProvider["kind"]) => setForm({ ...form, kind: k, baseUrl: DEFAULT_URLS[k] });

  const handleDetect = async () => {
    if (!form.apiKey) { toast.error("Informe a API key"); return; }
    setBusy(true);
    try {
      const r = await detect({ data: { kind: form.kind, baseUrl: form.baseUrl, apiKey: form.apiKey } });
      if (r.error) toast.error(r.error);
      setForm((f) => ({ ...f, models: r.models }));
      if (r.models.length) toast.success(`${r.models.length} modelos detectados`);
      else if (!r.error) toast.warning("Nenhum modelo retornado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha");
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.apiKey) { toast.error("Nome e API key obrigatórios"); return; }
    setBusy(true);
    try {
      await createProvider({ name: form.name, kind: form.kind, baseUrl: form.baseUrl, apiKey: form.apiKey, models: form.models });
      toast.success("Provedor cadastrado");
      setOpen(false);
      setForm({ name: "", kind: "openai", baseUrl: DEFAULT_URLS.openai, apiKey: "", models: [] });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setBusy(false); }
  };

  const refreshModels = async (p: LLMProvider) => {
    setBusy(true);
    try {
      const r = await detect({ data: { kind: p.kind, baseUrl: p.baseUrl, apiKey: p.apiKey } });
      if (r.error) { toast.error(r.error); return; }
      await updateProvider(p.id, { models: r.models });
      toast.success(`${r.models.length} modelos`);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Provedores LLM</h1>
          <p className="text-muted-foreground mt-1">Cadastre suas chaves de OpenAI, Anthropic, Gemini, Groq, DeepSeek e outros.</p>
        </div>
        <Button variant="hero" onClick={() => setOpen(true)}><Plus className="size-4" /> Cadastrar provedor</Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Cpu className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum provedor cadastrado</p>
          <p className="text-sm text-muted-foreground">Cadastre pelo menos um provedor para criar agentes.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="rounded-2xl bg-gradient-card border border-border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{p.name}</h3>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">{KIND_LABEL[p.kind]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{p.baseUrl || "—"}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => refreshModels(p)} disabled={busy} className="size-8 grid place-items-center rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
                  </button>
                  <button onClick={async () => { if (confirm(`Excluir ${p.name}?`)) { await deleteProvider(p.id); toast.success("Excluído"); } }} className="size-8 grid place-items-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">{p.models.length} modelos disponíveis</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {p.models.slice(0, 20).map((m) => (
                    <span key={m.id} className="text-[10px] px-2 py-1 rounded bg-secondary font-mono">{m.id}</span>
                  ))}
                  {p.models.length > 20 && <span className="text-[10px] text-muted-foreground">+{p.models.length - 20}</span>}
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
            <DialogDescription>Informe a URL e a chave. Detectamos os modelos disponíveis automaticamente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div><Label>Nome interno</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: OpenAI Produção" className="mt-1" /></div>
            <div>
              <Label>Provedor</Label>
              <Select value={form.kind} onValueChange={(v) => handleKind(v as LLMProvider["kind"])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Base URL</Label><Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="mt-1 font-mono text-xs" /></div>
            <div><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="mt-1 font-mono text-xs" /></div>

            <Button variant="outline" onClick={handleDetect} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin size-4" /> : <RefreshCw className="size-4" />}
              Detectar modelos
            </Button>

            {form.models.length > 0 && (
              <div className="rounded-lg border border-border p-3 max-h-40 overflow-y-auto">
                <p className="text-xs text-success flex items-center gap-1.5 mb-2"><CheckCircle2 className="size-3" /> {form.models.length} modelos detectados</p>
                <div className="flex flex-wrap gap-1">
                  {form.models.map((m) => <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono">{m.id}</span>)}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="hero" onClick={submit} disabled={busy}>Salvar provedor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
