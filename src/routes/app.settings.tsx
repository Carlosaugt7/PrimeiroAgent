import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados do workspace, integrações e segurança.</p>
      </div>

      <Section title="Workspace">
        <Field label="Nome da empresa" value="—" />
        <Field label="Subdomínio" value="—" />
        <Field label="Fuso horário" value="America/Sao_Paulo" />
      </Section>

      <Section title="Integrações">
        <p className="text-sm text-muted-foreground">Nenhuma integração configurada.</p>
      </Section>

      <Section title="Segurança">
        <Field label="Auditoria de eventos" value="—" />
        <Field label="LGPD · Data Processing Agreement" value="—" />
        <Field label="2FA obrigatório" value="—" />
      </Section>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-semibold text-destructive">Excluir workspace</p>
        <p className="text-xs text-muted-foreground mt-1">Esta ação é permanente. Todos os agentes, conversas e dados serão removidos.</p>
        <Button variant="outline" className="mt-3 border-destructive/40 text-destructive">Excluir workspace</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-6">
      <h2 className="font-display font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function Integration({ name, status, desc }: { name: string; status: "conectado" | "pendente" | "desconectado"; desc: string }) {
  const color = status === "conectado" ? "bg-success/15 text-success" : status === "pendente" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 border border-border">
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-1 rounded-full capitalize ${color}`}>{status}</span>
        <Button variant="outline" size="sm">{status === "conectado" ? "Configurar" : "Conectar"}</Button>
      </div>
    </div>
  );
}
