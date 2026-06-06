import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Zap } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

export function Hero() {
  return (
    <section className="relative pt-40 pb-24 overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-8">
          <Zap className="size-3.5 text-accent" />
          Plataforma SaaS Multi-Tenant para Agentes de IA
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
          Crie, treine e implante
          <br />
          <span className="text-gradient">agentes de IA no WhatsApp</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Conecte seus agentes ao WhatsApp via Evolution API em minutos.
          Sem terminal, sem código, sem configuração manual — apenas resultados para sua empresa.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/app">
            <Button variant="hero" size="xl">
              Iniciar teste grátis
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Button variant="outline" size="xl">
            <MessageCircle className="size-4" />
            Ver demonstração
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          14 dias grátis · Sem cartão de crédito · Cancele quando quiser
        </p>

        <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { value: "10k+", label: "Agentes ativos" },
            { value: "5M+", label: "Mensagens/mês" },
            { value: "99.9%", label: "Uptime SLA" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-display text-3xl font-bold text-gradient">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
