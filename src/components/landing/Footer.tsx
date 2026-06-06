import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-12 mt-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-gradient-primary grid place-items-center">
            <Sparkles className="size-3.5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">AgentHub AI</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} AgentHub AI. Todos os direitos reservados.
        </p>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground">Privacidade</a>
          <a href="#" className="hover:text-foreground">Termos</a>
          <a href="#" className="hover:text-foreground">Contato</a>
        </div>
      </div>
    </footer>
  );
}
