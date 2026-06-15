import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppStoreProvider, useAppStore } from "@/lib/app-store";
import { useAuth } from "@/lib/auth";
import { Loader2, LogOut, Search, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Console — AgentFlow IA" }] }),
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, tenant, loading, signOut, isMaster } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="animate-spin size-6 text-muted-foreground" />
      </div>
    );
  }

  // Logado, mas bootstrap de profile/tenant falhou — sai do loop e mostra erro
  if (!profile || !tenant) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="font-display text-xl font-semibold">
            Não foi possível carregar seu workspace
          </p>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão ou as permissões do banco. Se persistir, saia e entre novamente.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-secondary text-sm"
            >
              Recarregar
            </button>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = tenant?.planExpiresAt ? new Date() > new Date(tenant.planExpiresAt) : false;
  const isSuspended = (tenant?.status === "suspended" || isExpired) && !isMaster;
  const isBillingRoute = routerLocation.pathname === "/app/billing";

  if (isSuspended && !isBillingRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-card/50 text-center">
        <div className="max-w-md w-full space-y-6 bg-card/40 border border-border p-8 rounded-2xl shadow-glow backdrop-blur-xl">
          <div className="size-16 mx-auto rounded-full bg-destructive/10 grid place-items-center text-destructive">
            <span className="text-3xl">⚠️</span>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">Workspace Bloqueada</h1>
            <p className="text-sm text-muted-foreground">
              {isExpired 
                ? "O período de avaliação gratuita de 14 dias ou a sua assinatura expirou."
                : "Este workspace foi suspenso devido a falta de confirmação de pagamento."}
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Para reativar a sua conta e continuar usando todas as automações e agentes inteligentes, realize o pagamento no faturamento ou entre em contato com nosso suporte.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="hero" onClick={() => navigate({ to: "/app/billing" })} className="w-full">
              Ir para Faturamento & Planos
            </Button>
            <a href="https://wa.me/5581999999999" target="_blank" rel="noopener noreferrer" className="w-full text-left">
              <Button variant="outline" className="w-full">
                Falar com Suporte via WhatsApp
              </Button>
            </a>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
              className="text-xs text-muted-foreground hover:text-foreground pt-4 underline bg-transparent border-0 cursor-pointer"
            >
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const initials = (profile.displayName || profile.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <AppStoreProvider>
      <div className="min-h-screen flex">
        <AppSidebar tenantName={tenant.name} planName={tenant.plan} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border bg-card/30 backdrop-blur-xl flex items-center gap-4 px-6">
            <div className="flex-1 flex items-center gap-2 max-w-md">
              <div className="relative w-full">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Buscar agentes, contatos, conversas..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/60 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="size-9 rounded-full bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground">
                  {initials || "U"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium">{profile.displayName || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/app/settings" })}>
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/auth" });
                  }}
                  className="text-destructive"
                >
                  <LogOut className="size-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalQrCodeDialog />
    </AppStoreProvider>
  );
}

function GlobalQrCodeDialog() {
  const { activeQrFor, activeQrBase64, activeQrLoading, openQr, closeQr } = useAppStore();

  return (
    <Dialog
      open={!!activeQrFor}
      onOpenChange={(o) => {
        if (!o) closeQr();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp: {activeQrFor}</DialogTitle>
        </DialogHeader>
        <div className="py-3 text-center space-y-3">
          {activeQrLoading || !activeQrBase64 ? (
            <div className="h-64 grid place-items-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <img
              src={activeQrBase64}
              alt="QR Code WhatsApp"
              className="mx-auto rounded-lg bg-white p-2 max-w-[280px]"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Abra o WhatsApp → Aparelhos conectados → Escaneie o QR Code.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeQrFor && openQr(activeQrFor)}
            disabled={activeQrLoading}
          >
            <RefreshCw className={`size-3.5 ${activeQrLoading ? "animate-spin" : ""}`} /> Gerar novo
            QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
