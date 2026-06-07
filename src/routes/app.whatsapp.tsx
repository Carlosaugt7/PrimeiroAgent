import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { Smartphone, Construction } from "lucide-react";

export const Route = createFileRoute("/app/whatsapp")({ component: Page });

function Page() {
  const { instances } = useAppStore();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">WhatsApp Cloud Center</h1>
        <p className="text-muted-foreground mt-1">Conecte instâncias via Evolution API.</p>
      </div>

      {instances.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Smartphone className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma instância</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Construction className="size-3.5" /> Integração com Evolution API chega na Fase 3.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {instances.map((i) => (
            <li key={i.id} className="rounded-lg border border-border p-3 flex justify-between">
              <span>{i.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{i.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
