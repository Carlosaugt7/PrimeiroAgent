import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: Page });

function Page() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Master Admin</h1>
        <p className="text-muted-foreground mt-1">Painel exclusivo RS Consultoria.</p>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
        <ShieldCheck className="size-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-semibold">Acesso restrito</p>
        <p className="text-sm text-muted-foreground mt-1">O painel master_admin global será liberado na Fase 5 e exigirá promoção via console Firebase.</p>
      </div>
    </div>
  );
}
