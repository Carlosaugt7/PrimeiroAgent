import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore, type Integration } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Smartphone, Webhook, Send, Slack, KeyRound, Copy, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
});

const iconMap = {
  whatsapp: Smartphone, webhook: Webhook, telegram: Send, slack: Slack, api: KeyRound,
} as const;

const descMap: Record<Integration["kind"], string> = {
  whatsapp: "Conecte números do WhatsApp via Evolution API com um QR Code visual.",
  webhook: "Receba eventos do agente em qualquer URL HTTPS sua.",
  telegram: "Operação como bot do Telegram, ideal para comunidades.",
  slack: "Receba e responda mensagens dentro de canais do Slack.",
  api: "Consuma o agente como API REST autenticada por token.",
};

function IntegrationsPage() {
  const { integrations, toggleIntegration } = useAppStore();
  const [open, setOpen] = useState<Integration | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = "https://api.agenthub.ai/v1/agents/ag_1/webhook";
  const apiKey = "ah_sk_live_4f2a7c91e3b048d6";

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground mt-1">Conecte seus agentes a canais e sistemas — tudo via interface, sem terminal.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((i) => {
          const Icon = iconMap[i.kind];
          return (
            <div key={i.id} className="rounded-2xl bg-gradient-card border border-border p-5 shadow-card flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                  <Icon className="size-5 text-primary-foreground" />
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${i.status === "ativo" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {i.status}
                </span>
              </div>
              <h3 className="font-display font-semibold">{i.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{descMap[i.kind]}</p>
              <p className="text-xs text-muted-foreground mt-3 truncate">{i.detail}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(i)}>Configurar</Button>
                <Button variant={i.status === "ativo" ? "outline" : "hero"} onClick={() => toggleIntegration(i.id)}>
                  {i.status === "ativo" ? "Desligar" : "Ativar"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-elegant p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">{open.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{descMap[open.kind]}</p>

            {open.kind === "webhook" && (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground">URL de destino</span>
                  <input placeholder="https://exemplo.com/webhook" className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
                </label>
                <div className="rounded-lg bg-secondary/60 border border-border p-3">
                  <p className="text-xs text-muted-foreground">Endpoint do agente (entrada)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs flex-1 truncate">{webhookUrl}</code>
                    <button onClick={() => copy(webhookUrl)} className="text-muted-foreground hover:text-foreground">
                      {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {open.kind === "api" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-secondary/60 border border-border p-3">
                  <p className="text-xs text-muted-foreground">API Key</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs flex-1 truncate">{apiKey}</code>
                    <button onClick={() => copy(apiKey)} className="text-muted-foreground hover:text-foreground">
                      {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button variant="outline" className="w-full">Rotacionar chave</Button>
              </div>
            )}

            {open.kind === "telegram" && (
              <label className="block mt-4">
                <span className="text-xs text-muted-foreground">Bot token</span>
                <input placeholder="Cole o token do BotFather" className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
              </label>
            )}

            {open.kind === "slack" && (
              <Button variant="hero" className="w-full mt-4">Conectar com Slack</Button>
            )}

            {open.kind === "whatsapp" && (
              <div className="mt-4 text-sm">
                Use a página <span className="text-accent">WhatsApp</span> para gerar o QR Code e conectar números.
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setOpen(null)}>Fechar</Button>
              <Button variant="hero" onClick={() => setOpen(null)}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
