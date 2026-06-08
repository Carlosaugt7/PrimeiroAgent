import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/lib/app-store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bot,
  Check,
  ChevronRight,
  Cpu,
  FlaskConical,
  Loader2,
  PartyPopper,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({ meta: [{ title: "Começar — AgentHub AI" }] }),
  component: OnboardingPage,
});

type StepKey = "workspace" | "provider" | "agent" | "whatsapp" | "test";

function OnboardingPage() {
  const { tenant, profile } = useAuth();
  const { providers, agents, instances } = useAppStore();
  const navigate = useNavigate();

  const [workspaceName, setWorkspaceName] = useState(tenant?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const status = useMemo(
    () => ({
      workspace: !!tenant?.name && tenant.name.trim().length > 1,
      provider: providers.length > 0,
      agent: agents.length > 0,
      whatsapp: instances.length > 0,
      test: false, // marcado quando o usuário concluir manualmente
    }),
    [tenant, providers, agents, instances],
  );

  const steps: Array<{
    key: StepKey;
    title: string;
    desc: string;
    icon: typeof Bot;
    cta: string;
    to: string;
  }> = [
    {
      key: "workspace",
      title: "Nomeie sua workspace",
      desc: "Como sua equipe vai reconhecer este espaço.",
      icon: Sparkles,
      cta: "Editar nome",
      to: "/app/settings",
    },
    {
      key: "provider",
      title: "Conecte um provedor de IA",
      desc: "OpenAI, Anthropic, Gemini, Groq, DeepSeek ou OpenRouter.",
      icon: Cpu,
      cta: "Adicionar provedor",
      to: "/app/llm-providers",
    },
    {
      key: "agent",
      title: "Crie seu primeiro agente",
      desc: "Defina persona, prompt e modelo.",
      icon: Bot,
      cta: "Criar agente",
      to: "/app/agents",
    },
    {
      key: "whatsapp",
      title: "Conecte um WhatsApp",
      desc: "Crie uma instância e escaneie o QR Code.",
      icon: Smartphone,
      cta: "Conectar WhatsApp",
      to: "/app/whatsapp",
    },
    {
      key: "test",
      title: "Teste no Playground",
      desc: "Converse com seu agente antes de colocá-lo no ar.",
      icon: FlaskConical,
      cta: "Abrir Playground",
      to: "/app/playground",
    },
  ];

  const done = steps.filter((s) => status[s.key]).length;
  const pct = Math.round((done / steps.length) * 100);
  const allCoreDone = status.workspace && status.provider && status.agent && status.whatsapp;

  const saveName = async () => {
    if (!tenant || !workspaceName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ name: workspaceName.trim() })
        .eq("id", tenant.id);
      if (error) throw error;
    } catch (e: any) {
      console.warn("[onboarding] saveName failed:", e);
    } finally {
      setSavingName(false);
    }
  };

  const finish = async () => {
    if (!tenant) return;
    setFinishing(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          onboardedAt: new Date().toISOString(),
          onboardedBy: profile?.uid ?? "",
        })
        .eq("id", tenant.id);
      if (error) throw error;
      navigate({ to: "/app" });
    } catch (e: any) {
      console.warn("[onboarding] finish failed:", e);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent font-semibold">Começar aqui</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">
          Coloque seu agente no ar em minutos.
        </h1>
        <p className="text-muted-foreground mt-2">
          Siga os passos abaixo. Detectamos automaticamente seu progresso.
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">
            {done} de {steps.length} concluídos
          </p>
          <p className="text-sm text-muted-foreground">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => {
          const isDone = status[s.key];
          return (
            <div
              key={s.key}
              className={cn(
                "rounded-2xl border p-5 transition-all",
                isDone ? "bg-success/5 border-success/30" : "bg-gradient-card border-border",
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "size-10 rounded-xl grid place-items-center shrink-0",
                    isDone
                      ? "bg-success/20 text-success"
                      : "bg-gradient-primary text-primary-foreground shadow-glow",
                  )}
                >
                  {isDone ? <Check className="size-5" /> : <s.icon className="size-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono">0{i + 1}</span>
                    <h3 className="font-display font-semibold">{s.title}</h3>
                    {isDone && (
                      <span className="text-[11px] uppercase tracking-wider text-success font-semibold">
                        Concluído
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>

                  {s.key === "workspace" && (
                    <div className="mt-3 flex items-end gap-2 max-w-md">
                      <div className="flex-1">
                        <Label htmlFor="ws-name" className="text-xs">
                          Nome do workspace
                        </Label>
                        <Input
                          id="ws-name"
                          value={workspaceName}
                          onChange={(e) => setWorkspaceName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        onClick={saveName}
                        disabled={
                          savingName || !workspaceName.trim() || workspaceName === tenant?.name
                        }
                      >
                        {savingName && <Loader2 className="animate-spin size-4" />} Salvar
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Link to={s.to as never}>
                      <Button variant={isDone ? "outline" : "hero"} size="sm">
                        {isDone ? "Revisar" : s.cta} <ChevronRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <PartyPopper className="size-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display font-semibold">Tudo pronto?</p>
            <p className="text-sm text-muted-foreground">
              {allCoreDone
                ? "Você concluiu o essencial. Finalize para ocultar este guia."
                : "Conclua os passos essenciais para finalizar."}
            </p>
          </div>
        </div>
        <Button variant="hero" disabled={!allCoreDone || finishing} onClick={finish}>
          {finishing && <Loader2 className="animate-spin size-4" />} Concluir onboarding
        </Button>
      </div>
    </div>
  );
}
