import { Bot, Database, Globe, MessagesSquare, Shield, Workflow } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Agentes personalizáveis",
    desc: "Crie agentes treinados com sua base de conhecimento, tom de voz e regras de negócio específicas.",
  },
  {
    icon: MessagesSquare,
    title: "WhatsApp em 1 clique",
    desc: "Integração nativa com Evolution API. Conecte números e dispare conversas sem tocar em terminal.",
  },
  {
    icon: Database,
    title: "Base de conhecimento RAG",
    desc: "Faça upload de PDFs, sites e planilhas. Seus agentes respondem com contexto real da sua empresa.",
  },
  {
    icon: Workflow,
    title: "Fluxos e automações",
    desc: "Construa jornadas multi-etapa, handoff humano e integrações com seu CRM e ferramentas.",
  },
  {
    icon: Shield,
    title: "Multi-Tenant Enterprise",
    desc: "Isolamento total entre clientes, RBAC, auditoria e conformidade LGPD desde o primeiro dia.",
  },
  {
    icon: Globe,
    title: "Multi-canal",
    desc: "Além do WhatsApp, conecte web chat, Telegram e API. Um agente, todos os canais.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-28 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-3">Recursos</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
            Tudo que você precisa para
            <span className="text-gradient"> escalar IA conversacional</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative bg-gradient-card rounded-2xl p-6 border border-border shadow-card hover:shadow-glow hover:border-primary/40 transition-all duration-500"
            >
              <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center mb-5 shadow-glow">
                <f.icon className="size-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
