import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  component: Team,
});

const roleColors: Record<string, string> = {
  owner: "bg-gradient-primary text-primary-foreground",
  admin: "bg-accent/20 text-accent",
  editor: "bg-success/15 text-success",
  viewer: "bg-secondary text-muted-foreground",
};

function Team() {
  const { users } = useAppStore();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Equipe</h1>
          <p className="text-muted-foreground mt-1">Convide membros e defina papéis (RBAC).</p>
        </div>
        <Button variant="hero"><UserPlus className="size-4" /> Convidar membro</Button>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
            <tr><th className="text-left px-5 py-3">Membro</th><th className="text-left px-5 py-3">E-mail</th><th className="text-left px-5 py-3">Papel</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-5 py-3 flex items-center gap-3">
                  <div className="size-9 rounded-full bg-gradient-primary grid place-items-center text-xs font-semibold text-primary-foreground">
                    {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  {u.name}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${roleColors[u.role]}`}>{u.role}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="text-xs text-muted-foreground hover:text-foreground">Gerenciar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
