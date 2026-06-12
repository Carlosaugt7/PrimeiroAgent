import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Trial",
    price: "Grátis",
    desc: "14 dias para experimentar tudo.",
    features: ["1 agente ativo", "500 mensagens", "1 instância WhatsApp", "Suporte por e-mail"],
  },
  {
    name: "Starter",
    price: "R$ 97",
    desc: "Para autônomos e pequenos times.",
    features: [
      "3 agentes ativos",
      "5.000 mensagens/mês",
      "2 instâncias WhatsApp",
      "Campanhas por CSV",
      "Templates ilimitados",
    ],
  },
  {
    name: "Pro",
    price: "R$ 297",
    desc: "Para operações crescendo e captação ativa.",
    highlighted: true,
    features: [
      "10 agentes ativos",
      "30.000 mensagens/mês",
      "5 instâncias WhatsApp",
      "Extrator de contatos (Agenda/Grupos)",
      "Exportação nativa CSV/Excel",
      "Automações avançadas + API",
    ],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    desc: "Customização total, SLA e disparos em massa.",
    features: [
      "Agentes ilimitados",
      "Mensagens ilimitadas",
      "Instâncias ilimitadas",
      "Campanhas para Grupos de WhatsApp",
      "Mecanismo Anti-Ban (Digitação por API)",
      "SLA 99,9% + Onboarding dedicado",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-28 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-3">Planos</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
            Preço que <span className="text-gradient">escala com você</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Comece grátis por 14 dias. Sem fidelidade.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl p-7 border transition-all ${
                p.highlighted
                  ? "bg-gradient-card border-primary/50 shadow-glow scale-[1.02]"
                  : "bg-gradient-card border-border shadow-card"
              }`}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Mais popular
                </div>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                {p.price.startsWith("R$") && (
                  <span className="text-muted-foreground text-sm">/mês</span>
                )}
              </div>
              <Button
                variant={p.highlighted ? "hero" : "outline"}
                className="w-full mt-6"
                size="lg"
              >
                {p.name === "Enterprise"
                  ? "Falar com vendas"
                  : p.name === "Trial"
                    ? "Começar grátis"
                    : "Assinar agora"}
              </Button>
              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="size-4 text-success shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
