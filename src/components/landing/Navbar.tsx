import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="glass rounded-2xl flex items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              AgentHub<span className="text-gradient"> AI</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#how" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/app"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Entrar</Button></Link>
            <Link to="/app"><Button variant="hero" size="sm">Abrir console</Button></Link>
          </div>
        </div>
      </div>
    </header>
  );
}
