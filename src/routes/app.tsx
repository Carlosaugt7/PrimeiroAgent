import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
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
  const { user, profile, tenant, loading, signOut } = useAuth();
  const navigate = useNavigate();

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
              onClick={() => location.reload()}
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
