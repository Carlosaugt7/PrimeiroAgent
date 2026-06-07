import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
export const Route = createFileRoute("/app/billing")({ component: Page });
function Page() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-3xl font-bold">Planos & uso</h1>
      <p className="text-muted-foreground">Faturamento, consumo de tokens e mensagens.</p>
      <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-12 text-center">
        <Construction className="size-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-semibold">Em construção</p>
        <p className="text-sm text-muted-foreground">Disponível na Fase 5.</p>
      </div>
    </div>
  );
}
