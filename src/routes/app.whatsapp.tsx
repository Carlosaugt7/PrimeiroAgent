import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Smartphone, QrCode, CheckCircle2, Loader2, Power } from "lucide-react";

export const Route = createFileRoute("/app/whatsapp")({
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const { agents, connectWhatsapp, updateAgent } = useAppStore();
  const [connecting, setConnecting] = useState<string | null>(null);

  const startConnect = (agentId: string) => {
    setConnecting(agentId);
    updateAgent(agentId, { whatsapp: "aguardando_qr" });
    setTimeout(() => {
      connectWhatsapp(agentId, `+55 11 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`);
      setConnecting(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">WhatsApp · Evolution API</h1>
        <p className="text-muted-foreground mt-1">Conecte números aos seus agentes em poucos cliques. Sem terminal, sem configuração manual.</p>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-primary/30 p-5 flex items-center gap-4">
        <div className="size-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <CheckCircle2 className="size-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Evolution API conectada</p>
          <p className="text-xs text-muted-foreground">Workspace · Acme Comércio · região: São Paulo</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-success/15 text-success">healthy</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {agents.map((a) => (
          <div key={a.id} className="rounded-2xl bg-gradient-card border border-border p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-secondary grid place-items-center">
                  <Smartphone className="size-5 text-accent" />
                </div>
                <div>
                  <p className="font-display font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.segment}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full ${a.whatsapp === "conectado" ? "bg-success/15 text-success" : a.whatsapp === "aguardando_qr" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                {a.whatsapp.replace("_", " ")}
              </span>
            </div>

            <div className="mt-5">
              {a.whatsapp === "conectado" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-mono">{a.whatsappNumber}</span>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => updateAgent(a.id, { whatsapp: "desconectado", whatsappNumber: undefined })}>
                    <Power className="size-4" /> Desconectar
                  </Button>
                </div>
              )}
              {a.whatsapp === "aguardando_qr" && (
                <div className="text-center py-4">
                  <div className="size-32 mx-auto rounded-lg bg-foreground/95 grid place-items-center">
                    {connecting === a.id ? <Loader2 className="size-8 text-background animate-spin" /> : <QrCode className="size-20 text-background" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Escaneie no WhatsApp → Aparelhos conectados</p>
                </div>
              )}
              {a.whatsapp === "desconectado" && (
                <Button variant="hero" className="w-full" onClick={() => startConnect(a.id)}>
                  <QrCode className="size-4" /> Gerar QR Code
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
