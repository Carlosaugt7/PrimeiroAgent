import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAppStore, type Persona } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Plus, Search, MessageCircle, Smartphone, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/agents/")({
  component: AgentsList,
});

const templates: Array<{
  name: string;
  segment: string;
  category: string;
  desc: string;
  prompt: string;
  persona: Partial<Persona>;
}> = [
  {
    name: "Vendas (SDR)",
    segment: "Vendas",
    category: "Comercial",
    desc: "Qualifica e converte leads automaticamente",
    prompt:
      "Você é um SDR (Sales Development Representative). Seu objetivo é qualificar leads usando o framework BANT (Budget, Authority, Need, Timeline) e agendar uma reunião com o consultor humano. Seja cordial, consultivo e nunca pressione.",
    persona: {
      name: "Sofia",
      role: "SDR",
      specialty: "Qualificação de leads B2B",
      tone: "Profissional e consultiva",
    },
  },
  {
    name: "Suporte N1",
    segment: "Suporte",
    category: "Atendimento",
    desc: "Resolve dúvidas frequentes e abre tickets",
    prompt:
      "Você é um agente de suporte nível 1. Resolve dúvidas usando a base de conhecimento, segue scripts de troubleshooting e escala para humano quando o problema for crítico ou fora do escopo.",
    persona: {
      name: "Léo",
      role: "Atendente",
      specialty: "Suporte técnico",
      tone: "Paciente e didático",
    },
  },
  {
    name: "Clínica / Agendamento",
    segment: "Saúde",
    category: "Agendamento",
    desc: "Marca consultas e confirma presença",
    prompt:
      "Você é a recepcionista virtual de uma clínica. Agenda consultas verificando disponibilidade, confirma presença 24h antes e nunca fornece diagnóstico médico.",
    persona: {
      name: "Carla",
      role: "Recepcionista",
      specialty: "Agendamento médico",
      tone: "Acolhedora e empática",
    },
  },
  {
    name: "Imobiliária",
    segment: "Imobiliária",
    category: "Comercial",
    desc: "Captação e qualificação de interessados",
    prompt:
      "Você é corretor virtual de imóveis. Capta o perfil do cliente (compra/aluguel, faixa de preço, bairro, dormitórios) e envia opções compatíveis. Encaminha visitas para o corretor humano.",
    persona: {
      name: "Rafa",
      role: "Corretor",
      specialty: "Imóveis residenciais",
      tone: "Confiante e informativo",
    },
  },
];

const empty = {
  name: "",
  description: "",
  segment: "Vendas",
  category: "Comercial",
  department: "Atendimento",
  systemPrompt: "Você é um assistente prestativo.",
  providerId: "",
  model: "",
  temperature: 0.5,
  topP: 1,
  maxTokens: 1024,
  memory: "vetorial" as const,
  persona: {
    name: "",
    role: "",
    specialty: "",
    tone: "Profissional, cordial",
    writingStyle: "Direto e claro",
    rules: "",
    goals: "",
  } satisfies Persona,
};

function AgentsList() {
  const { agents, providers, createAgent, updateAgent, deleteAgent, instances } = useAppStore();
  const [open, setOpen] = useState(() => localStorage.getItem("agentflow_draft_open") === "true");
  const [q, setQ] = useState("");
  const [step, setStep] = useState<"basic" | "persona" | "prompt" | "model">(() => {
    const s = localStorage.getItem("agentflow_draft_step");
    return (s as "basic" | "persona" | "prompt" | "model") || "basic";
  });
  const [form, setForm] = useState(() => {
    const s = localStorage.getItem("agentflow_draft_form");
    try {
      return s ? JSON.parse(s) : empty;
    } catch {
      return empty;
    }
  });
  const [busy, setBusy] = useState(false);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem("agentflow_draft_open", String(open));
    localStorage.setItem("agentflow_draft_step", step);
    localStorage.setItem("agentflow_draft_form", JSON.stringify(form));
  }, [open, step, form]);

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  const provider = providers.find((p) => p.id === form.providerId);

  const reset = () => {
    setForm(empty);
    setStep("basic");
    localStorage.removeItem("agentflow_draft_form");
    localStorage.removeItem("agentflow_draft_step");
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do agente");
      setStep("basic");
      return;
    }
    if (!form.providerId || !form.model) {
      toast.error("Selecione provedor e modelo");
      setStep("model");
      return;
    }
    setBusy(true);
    try {
      await createAgent(form);
      toast.success("Agente criado");
      setOpen(false);
      reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir agente "${name}"?`)) return;
    await deleteAgent(id);
    toast.success("Agente excluído");
  };

  const handleToggleAutoReply = async (id: string, autoReply: boolean) => {
    try {
      await updateAgent(id, { autoReply });
      toast.success(
        autoReply ? "Respostas automáticas ativadas" : "Respostas automáticas desativadas",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar agente";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Agentes</h1>
          <p className="text-muted-foreground mt-1">
            Crie, treine e publique agentes especializados.
          </p>
        </div>
        <Button
          variant="hero"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Novo agente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9 h-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Bot className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum agente ainda</p>
          <p className="text-sm text-muted-foreground mb-4">
            Clique em "Novo agente" para começar.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="group rounded-2xl bg-gradient-card border border-border p-5 shadow-card hover:border-primary/40 hover:shadow-glow transition-all flex flex-col justify-between"
            >
              <Link to="/app/agents/$id" params={{ id: a.id }} className="block flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                    <Bot className="size-5 text-primary-foreground" />
                  </div>
                </div>
                <h3 className="font-display font-semibold text-lg group-hover:text-primary transition-colors">
                  {a.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {a.description || "Sem descrição"}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  {(() => {
                    const linkedInstance = instances.find((inst) => inst.name === a.whatsappInstanceId);
                    const currentStatus = linkedInstance ? linkedInstance.status : a.status;
                    let cls = "bg-muted text-muted-foreground";
                    if (currentStatus === "online") cls = "bg-success/15 text-success";
                    else if (currentStatus === "conectando") cls = "bg-amber-500/15 text-amber-500";
                    else if (currentStatus === "treinando") cls = "bg-accent/15 text-accent";
                    return (
                      <span className={`text-[10px] px-2 py-1 rounded-full ${cls}`}>
                        {currentStatus}
                      </span>
                    );
                  })()}
                  <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                    {a.segment}
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                    v{a.promptVersion}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageCircle className="size-3" /> Msgs
                    </div>
                    <p className="font-display font-semibold mt-0.5">
                      {(a.messages30d || 0).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Smartphone className="size-3" /> Modelo
                    </div>
                    <p className="text-xs mt-1 truncate">{a.model || "—"}</p>
                  </div>
                </div>
              </Link>

              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={!!a.autoReply}
                    onCheckedChange={(checked) => handleToggleAutoReply(a.id, checked)}
                    aria-label="Ativar respostas automáticas"
                  />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Respostas Aut.
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    to="/app/agents/$id"
                    params={{ id: a.id }}
                    className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                    title="Editar agente"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(a.id, a.name);
                    }}
                    className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    title="Excluir agente"
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo agente</DialogTitle>
            <DialogDescription>
              Configure em 4 passos. Você pode editar tudo depois.
            </DialogDescription>
          </DialogHeader>

          {step === "basic" && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {templates.map((t) => (
                <button
                  key={t.name}
                  onClick={() =>
                    setForm((f: typeof empty) => ({
                      ...f,
                      name: t.name,
                      segment: t.segment,
                      category: t.category,
                      description: t.desc,
                      systemPrompt: t.prompt,
                      persona: { ...f.persona, ...t.persona } as Persona,
                    }))
                  }
                  className="text-left rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
                >
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          )}

          <Tabs value={step} onValueChange={(v) => setStep(v as typeof step)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">1. Básico</TabsTrigger>
              <TabsTrigger value="persona">2. Persona</TabsTrigger>
              <TabsTrigger value="prompt">3. Prompt</TabsTrigger>
              <TabsTrigger value="model">4. Modelo</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3 pt-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Departamento</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Segmento</Label>
                  <Select
                    value={form.segment}
                    onValueChange={(v) => setForm({ ...form, segment: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Vendas",
                        "Suporte",
                        "Saúde",
                        "Imobiliária",
                        "E-commerce",
                        "Educação",
                        "Financeiro",
                        "Outros",
                      ].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="persona" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome da persona</Label>
                  <Input
                    value={form.persona.name}
                    onChange={(e) =>
                      setForm({ ...form, persona: { ...form.persona, name: e.target.value } })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input
                    value={form.persona.role}
                    onChange={(e) =>
                      setForm({ ...form, persona: { ...form.persona, role: e.target.value } })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Especialidade</Label>
                  <Input
                    value={form.persona.specialty}
                    onChange={(e) =>
                      setForm({ ...form, persona: { ...form.persona, specialty: e.target.value } })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Tom de voz</Label>
                  <Input
                    value={form.persona.tone}
                    onChange={(e) =>
                      setForm({ ...form, persona: { ...form.persona, tone: e.target.value } })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Estilo de escrita</Label>
                  <Input
                    value={form.persona.writingStyle}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        persona: { ...form.persona, writingStyle: e.target.value },
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Regras comportamentais</Label>
                  <Textarea
                    rows={2}
                    value={form.persona.rules}
                    onChange={(e) =>
                      setForm({ ...form, persona: { ...form.persona, rules: e.target.value } })
                    }
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Objetivos</Label>
                  <Textarea
                    rows={2}
                    value={form.persona.goals}
                    onChange={(e) =>
                      setForm({ ...form, persona: { ...form.persona, goals: e.target.value } })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="space-y-3 pt-4">
              <Label>Prompt do sistema</Label>
              <p className="text-xs text-muted-foreground">
                Suporta variáveis como <code className="text-accent">{"{{nome}}"}</code>,{" "}
                <code className="text-accent">{"{{empresa}}"}</code>.
              </p>
              <Textarea
                rows={12}
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                className="font-mono text-xs"
              />
            </TabsContent>

            <TabsContent value="model" className="space-y-3 pt-4">
              {providers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm font-semibold">Nenhum provedor cadastrado</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Cadastre um provedor LLM antes.
                  </p>
                  <Link to="/app/llm-providers">
                    <Button variant="outline" size="sm">
                      Cadastrar provedor
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Provedor</Label>
                    <Select
                      value={form.providerId}
                      onValueChange={(v) => setForm({ ...form, providerId: v, model: "" })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} <span className="text-muted-foreground">({p.kind})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo</Label>
                    <Select
                      value={form.model}
                      onValueChange={(v) => setForm({ ...form, model: v })}
                      disabled={!provider}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue
                          placeholder={provider ? "Selecione..." : "Escolha um provedor"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {provider?.models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.id}
                            {m.contextWindow ? ` · ${m.contextWindow.toLocaleString()} tokens` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Temperatura ({form.temperature})</Label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={form.temperature}
                        onChange={(e) =>
                          setForm({ ...form, temperature: Number.parseFloat(e.target.value) })
                        }
                        className="w-full accent-primary mt-3"
                      />
                    </div>
                    <div>
                      <Label>Top P ({form.topP})</Label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={form.topP}
                        onChange={(e) =>
                          setForm({ ...form, topP: Number.parseFloat(e.target.value) })
                        }
                        className="w-full accent-primary mt-3"
                      />
                    </div>
                    <div>
                      <Label>Max tokens</Label>
                      <Input
                        type="number"
                        value={form.maxTokens}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            maxTokens: Number.parseInt(e.target.value, 10) || 1024,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {step === "model" ? (
              <Button variant="hero" onClick={submit} disabled={busy}>
                {busy ? "Criando..." : "Criar agente"}
              </Button>
            ) : (
              <Button
                variant="hero"
                onClick={() => {
                  const order = ["basic", "persona", "prompt", "model"] as const;
                  const i = order.indexOf(step);
                  setStep(order[i + 1]);
                }}
              >
                Próximo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
