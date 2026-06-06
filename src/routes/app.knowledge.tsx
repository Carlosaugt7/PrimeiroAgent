import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { FileText, Globe, Sheet, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/app/knowledge")({
  component: Knowledge,
});

const iconMap = { pdf: FileText, site: Globe, planilha: Sheet, texto: FileText } as const;

function Knowledge() {
  const { docs, agents, addDoc, removeDoc } = useAppStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"pdf" | "site" | "planilha" | "texto">("pdf");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");

  const submit = () => {
    if (!name.trim()) return;
    addDoc({ name, type, sizeKb: Math.floor(Math.random() * 2000), agentId });
    setName(""); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Base de conhecimento</h1>
          <p className="text-muted-foreground mt-1">Documentos, sites e arquivos que treinam seus agentes (RAG).</p>
        </div>
        <Button variant="hero" onClick={() => setOpen(true)}><Upload className="size-4" /> Adicionar fonte</Button>
      </div>

      <div className="rounded-2xl bg-gradient-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-5 py-3">Nome</th>
              <th className="text-left px-5 py-3">Tipo</th>
              <th className="text-left px-5 py-3">Tamanho</th>
              <th className="text-left px-5 py-3">Agente</th>
              <th className="text-left px-5 py-3">Adicionado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const Icon = iconMap[d.type];
              const agent = agents.find((a) => a.id === d.agentId);
              return (
                <tr key={d.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-5 py-3 flex items-center gap-2"><Icon className="size-4 text-accent" /> {d.name}</td>
                  <td className="px-5 py-3 uppercase text-xs text-muted-foreground">{d.type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.sizeKb} KB</td>
                  <td className="px-5 py-3">{agent?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.uploadedAt}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => removeDoc(d.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-elegant p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Adicionar fonte de conhecimento</h2>
            <div className="space-y-3 mt-4">
              <label className="block">
                <span className="text-xs text-muted-foreground">Nome ou URL</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm" />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Tipo</span>
                <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                  <option value="pdf">PDF</option><option value="site">Site (URL)</option>
                  <option value="planilha">Planilha</option><option value="texto">Texto</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Agente</span>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm">
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                <Upload className="size-6 mx-auto mb-2 text-accent" />
                Arraste arquivos aqui ou clique para enviar
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="hero" onClick={submit}>Adicionar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
