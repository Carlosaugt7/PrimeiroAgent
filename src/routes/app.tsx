import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppStoreProvider } from "@/lib/app-store";
import { Bell, Search } from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Console — AgentHub AI" }] }),
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppStoreProvider>
      <div className="min-h-screen flex">
        <AppSidebar />
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
            <button className="size-9 rounded-lg grid place-items-center hover:bg-secondary/60">
              <Bell className="size-4" />
            </button>
            <div className="size-9 rounded-full bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground">
              AM
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </AppStoreProvider>
  );
}
