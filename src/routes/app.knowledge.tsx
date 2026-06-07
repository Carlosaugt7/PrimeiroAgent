import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { Database, Construction } from "lucide-react";

export const Route = createFileRoute("/app/knowledge")({ component: Page });

function Page() {
  const { knowledge } = useAppStore();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Base de conhecimento</h1>
        <p className="text-muted-foreground mt-1">Upload de arquivos, FAQs e sites para treinar seus agentes (RAG).</p>
      </div>

      {knowledge.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Database className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum documento</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Construction className="size-3.5" /> Upload e vetorização chegam na Fase 4.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {knowledge.map((d) => (
            <li key={d.id} className="rounded-lg border border-border p-3 text-sm flex justify-between">
              <span>{d.name}</span>
              <span className="text-muted-foreground text-xs">{d.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
