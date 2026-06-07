
# Refatoração do Dashboard AgentHub AI

Mantém a landing page atual (`/`) intacta. Toda área `/app/*` será reconstruída como SaaS multi-tenant real com Firebase Auth + Firestore + Storage.

## Escopo

A entrega é grande — proponho dividir em **5 fases**, aprovando uma de cada vez para garantir qualidade. Esta primeira aprovação cobre fases 1–2 (fundação + núcleo). Fases 3–5 são plano de execução.

---

## Fase 1 — Fundação Multi-Tenant + Auth (esta entrega)

**Auth real (Firebase Auth):**
- Login / Signup com e-mail+senha e Google
- Rota pública `/auth` (login + cadastro em tabs)
- Guard de rota: `/app/*` redireciona para `/auth` se deslogado
- Logout no header

**Multi-tenancy real no Firestore:**
- Ao criar conta → cria `tenants/{tenantId}` com dono e plano "trial"
- Todo dado vive em `tenants/{tenantId}/...` (isolamento total)
- Coleções por tenant: `agents`, `conversations`, `contacts`, `knowledge`, `audios`, `instances`, `flows`, `crm_leads`, `prompt_versions`, `llm_providers`, `audit_logs`
- Coleção raiz `users/{uid}` com `tenantId` e papel (`owner|admin|editor|viewer|agent`)
- Coleção raiz `master_admins/{uid}` para o painel RS Consultoria

**Regras de segurança Firestore** (gerar `firestore.rules` para o usuário colar no console Firebase) — leitura/escrita só dentro do próprio tenant, master_admin com acesso global.

**Store reescrita:** `app-store.tsx` passa a aceitar `tenantId` e sincronizar subcoleções do tenant ativo.

---

## Fase 2 — Núcleo do Cliente

**Dashboard `/app`:** KPIs reais (conversas hoje, leads, agentes ativos, custo IA estimado, msgs, tempo médio, instâncias conectadas) calculados de Firestore.

**Agentes `/app/agents`:**
- Wizard de criação em 4 passos: Básico → Persona → Prompt → Modelo
- Editor de prompt avançado com variáveis `{{nome}}`, templates, **versionamento** (subcoleção `prompt_versions`)
- Seletor de provedor LLM já cadastrado + modelo
- Toggle ativo/inativo, duplicar, excluir

**Provedores LLM `/app/llm-providers`** (novo):
- Cadastrar: nome, provedor (Anthropic/Google/OpenAI/Groq/DeepSeek/OpenRouter), URL base, API key (criptografada via server fn)
- Botão "Detectar modelos" → server fn chama `/v1/models` do provedor e popula modelos disponíveis + context window
- Lista de modelos por provedor com preços

**Playground `/app/playground`:**
- Chat de teste com qualquer agente
- Painel lateral: prompt resolvido, tokens IN/OUT, tempo, custo estimado
- Cenários pré-prontos: vendas, suporte, objeção

---

## Fase 3 — WhatsApp + Conversas (plano)

- `/app/whatsapp`: CRUD de instâncias via **Evolution API** (`https://evolution-api.rsconsultoria.pro`) — criar, conectar (QR code modal), desconectar, reiniciar, excluir, status realtime
- Server functions TanStack proxy para Evolution (API key da Evolution como secret)
- Webhook receiver em `/api/public/evolution/$instanceId` → grava mensagens em `conversations`
- `/app/inbox`: lista contatos + thread estilo WhatsApp Business, assumir/encerrar/transferir, handoff IA↔humano

---

## Fase 4 — Conhecimento + Automações + CRM (plano)

- **RAG `/app/knowledge`**: upload PDF/DOCX/XLSX/TXT/CSV/JSON para Firebase Storage, FAQ manual, crawler de site (server fn), status de indexação. *Nota: vetorização real precisa de pgvector ou serviço externo — Firestore não tem vetorial nativo; proponho usar Pinecone/Supabase pgvector como complemento, ou armazenar embeddings em Firestore com busca aproximada client-side para começar.*
- **Áudios `/app/audios`**: biblioteca no Storage, categorias, agente pode anexar
- **Flow Builder `/app/flows`**: editor visual com React Flow — nós Mensagem/Condição/IA/API/Delay/Humano/WhatsApp
- **CRM `/app/crm`**: leads, kanban (Novo→Contato→Negociação→Fechado), drag-and-drop

---

## Fase 5 — Master Admin + Relatórios + Segurança (plano)

- `/master/*` (rota separada, só `master_admins`): tenants, planos, consumo de tokens/LLM, msgs, agentes, storage, ativar/suspender, financeiro, dashboard global
- `/app/reports`: BI com gráficos (recharts) — msgs, conversões, vendas, leads, custos, uso por agente/usuário
- Auditoria: trigger em writes grava `audit_logs`
- MFA via Firebase Auth, RBAC já no schema, exportação LGPD

---

## Detalhes técnicos

- **Stack mantida:** TanStack Start + React 19 + Tailwind v4 + shadcn — Next/NestJS do briefing original não se aplicam pois o projeto já está em TanStack (mudar de stack seria recomeçar do zero). Firebase substitui Postgres+Redis+S3 para esta versão.
- **Server functions** (`createServerFn`) para: chamadas LLM, detectar modelos, proxy Evolution API, crawler, criptografar API keys.
- **Secrets necessários** (pedirei via `add_secret` quando entrar a fase): `EVOLUTION_API_KEY`, opcionalmente `LOVABLE_API_KEY` para playground sem cadastrar provedor.
- **Realtime:** `onSnapshot` do Firestore (já em uso).
- **Storage:** Firebase Storage para arquivos RAG, áudios, fotos de agente.

## Limites honestos

1. **Vetorização RAG:** Firestore não é banco vetorial. Para RAG decente precisaremos de Pinecone (free tier) ou Supabase pgvector. Decidiremos na Fase 4.
2. **Evolution API:** preciso que você confirme se a API key do servidor `evolution-api.rsconsultoria.pro` pode ser usada (vou pedir como secret na Fase 3).
3. **Regras Firestore:** você precisará colar manualmente as regras geradas no console Firebase (não tenho acesso ao projeto Firebase).
4. **Master Admin:** primeiro `master_admin` precisa ser promovido manualmente via console Firebase (script SQL-equivalente fornecido).

---

## O que entrego ao aprovar este plano

**Fases 1 + 2 completas** em um único push:
- Auth + multi-tenant + guards + regras Firestore
- Dashboard com KPIs reais
- CRUD completo de Agentes com wizard + versionamento de prompt
- Cadastro de provedores LLM + detecção automática de modelos
- Playground funcional

Depois disso, eu apresento Fase 3 para nova aprovação.

**Aprova esta abordagem (5 fases, começando por 1+2)?**
