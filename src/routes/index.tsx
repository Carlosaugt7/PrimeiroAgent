import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgentFlow IA — Agentes de IA para WhatsApp em minutos" },
      {
        name: "description",
        content:
          "Plataforma SaaS Enterprise para criar, treinar e implantar agentes de IA conectados ao WhatsApp via Evolution API. Multi-tenant, sem código, sem terminal.",
      },
      { property: "og:title", content: "AgentFlow IA — Agentes de IA para WhatsApp" },
      {
        property: "og:description",
        content:
          "Crie agentes de IA personalizados e conecte ao WhatsApp em minutos. Plataforma SaaS multi-tenant enterprise.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
