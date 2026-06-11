const steps = [
  {
    n: "01",
    title: "Crie seu agente",
    desc: "Escolha um template por segmento (e-commerce, clínica, imobiliária...) ou comece do zero.",
  },
  {
    n: "02",
    title: "Treine com sua base",
    desc: "Faça upload de documentos, conecte sites e defina o tom de voz da sua marca.",
  },
  {
    n: "03",
    title: "Conecte o WhatsApp",
    desc: "Escaneie o QR Code uma vez e seu agente está online — gerenciado pela Evolution API.",
  },
  {
    n: "04",
    title: "Acompanhe e otimize",
    desc: "Dashboards em tempo real, métricas de conversão e refinamento contínuo.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-28 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-3">
            Como funciona
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
            Do zero ao primeiro atendimento <span className="text-gradient">em minutos</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="bg-gradient-card rounded-2xl p-6 border border-border h-full shadow-card">
                <div className="font-display text-5xl font-bold text-gradient mb-4">{s.n}</div>
                <h3 className="font-display text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 size-6 rounded-full bg-gradient-primary opacity-60" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
