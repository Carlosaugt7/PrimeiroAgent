import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { profile, tenant, signOut } = useAuth();
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados do workspace e da conta.</p>
      </div>

      <Section title="Workspace">
        <Field label="Nome" value={tenant?.name ?? "—"} />
        <Field label="Plano" value={tenant?.plan ?? "—"} />
        <Field label="Status" value={tenant?.status ?? "—"} />
        <Field label="ID" value={tenant?.id ?? "—"} />
      </Section>

      <Section title="Sua conta">
        <Field label="Nome" value={profile?.displayName ?? "—"} />
        <Field label="E-mail" value={profile?.email ?? "—"} />
        <Field label="Papel" value={profile?.role ?? "—"} />
      </Section>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-semibold text-destructive">Encerrar sessão</p>
        <p className="text-xs text-muted-foreground mt-1">Você precisará entrar novamente.</p>
        <Button variant="outline" className="mt-3 border-destructive/40 text-destructive" onClick={signOut}>Sair</Button>
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
    <div className="flex justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm capitalize truncate">{value}</span>
    </div>
  );
}
