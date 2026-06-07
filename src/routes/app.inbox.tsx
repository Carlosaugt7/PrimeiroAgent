import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/app-store";
import { MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/app/inbox")({ component: Inbox });

function Inbox() {
  const { conversations } = useAppStore();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Inbox</h1>
        <p className="text-muted-foreground mt-1">Central de conversas.</p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <MessagesSquare className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma conversa</p>
          <p className="text-sm text-muted-foreground mt-1">As conversas aparecem aqui quando seus agentes começarem a atender.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3 flex justify-between">
              <div>
                <p className="font-medium text-sm">{c.contactName}</p>
                <p className="text-xs text-muted-foreground truncate max-w-md">{c.lastMessage}</p>
              </div>
              <span className="text-xs text-muted-foreground">{c.updatedAt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
