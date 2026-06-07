import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
export const Route = createFileRoute("/app/deploy")({ component: Page });
function Page() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-3xl font-bold">Deploy</h1>
      <p className="text-muted-foreground">Versionamento e promoção dev → prod.</p>
      <div className="mt-8 rounded-2xl border-2 border-dashed border-border p-12 text-center">
        <Construction className="size-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-semibold">Em breve</p>
      </div>
    </div>
  );
}
