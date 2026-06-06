import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Rocket, Undo2, GitBranch, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/deploy")({
  component: DeployPage,
});

function DeployPage() {
  const { agents, deployments, promoteDeployment } = useAppStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Deploy</h1>
        <p className="text-muted-foreground mt-1">Promova agentes para produção e faça rollback com um clique — substitui <code>agentfield deploy</code>.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Agentes em produção" value={String(deployments.filter((d) => d.env === "prod" && d.status === "ativo").length)} />
        <Stat label="Em homologação" value={String(deployments.filter((d) => d.env === "dev").length)} />
        <Stat label="Último deploy" value="hoje · 09:10" />
      </div>

      <div className="space-y-3">
        {agents.map((a) => {
          const prod = deployments.find((d) => d.agentId === a.id && d.env === "prod");
          const dev = deployments.find((d) => d.agentId === a.id && d.env === "dev");
          const hasNewer = dev && (!prod || dev.version > prod.version);
          return (
            <div key={a.id} className="rounded-2xl bg-gradient-card border border-border p-5 shadow-card">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-display font-semibold">{a.name}</h3>
                  <p className="text-xs text-muted-foreground">{a.segment} · {a.model}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <EnvCol label="dev" version={dev?.version} when={dev?.deployedAt} highlight={!!hasNewer} />
                  <EnvCol label="prod" version={prod?.version} when={prod?.deployedAt} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={!prod}>
                    <Undo2 className="size-4" /> Rollback
                  </Button>
                  <Button variant="hero" disabled={!hasNewer} onClick={() => promoteDeployment(a.id)}>
                    <Rocket className="size-4" /> Promover {dev?.version} → prod
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border p-5">
        <h2 className="font-display font-semibold mb-3 flex items-center gap-2"><GitBranch className="size-4 text-accent" /> Histórico</h2>
        <div className="space-y-2 text-sm">
          {deployments.slice().reverse().map((d) => {
            const a = agents.find((x) => x.id === d.agentId);
            return (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="font-medium">{a?.name}</span>
                  <span className="text-muted-foreground">{d.version}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.env === "prod" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{d.env}</span>
                </div>
                <span className="text-xs text-muted-foreground">{d.deployedAt} · {d.deployedBy}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function EnvCol({ label, version, when, highlight }: { label: string; version?: string; when?: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider ${highlight ? "text-accent" : "text-muted-foreground"}`}>{label}</p>
      <p className="font-mono text-sm">{version ?? "—"}</p>
      <p className="text-[10px] text-muted-foreground">{when ?? ""}</p>
    </div>
  );
}
