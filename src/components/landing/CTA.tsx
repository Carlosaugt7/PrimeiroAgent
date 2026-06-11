import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-card border border-primary/30 p-12 md:p-16 text-center shadow-elegant">
          <div className="absolute inset-0 -z-10 opacity-40 bg-gradient-primary blur-3xl" />
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
            Pronto para colocar a IA <br />
            <span className="text-gradient">trabalhando 24/7?</span>
          </h2>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
            Junte-se a centenas de empresas que automatizaram atendimento, vendas e suporte com
            AgentHub AI.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button variant="hero" size="xl">
              Criar minha conta
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="xl">
              Agendar demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
