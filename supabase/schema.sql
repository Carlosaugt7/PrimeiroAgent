-- cspell:disable
-- =====================================================
-- AgentHub AI: MIGRATION COMPLETA
-- =====================================================
-- Este script DROPA as tabelas antigas (criadas pelo Lovable com nomes incompatíveis)
-- e recria com a estrutura correta que o código TypeScript espera.
-- SEGURO de rodar se a conta é nova/sem dados real.
-- =====================================================

-- Extensões
create extension if not exists "pgcrypto";

-- =====================================================
-- PASSO 1: DROPAR TABELAS ANTIGAS (ordem inversa de dependência)
-- =====================================================
drop table if exists public.knowledge_chunks cascade;
drop table if exists public.knowledge cascade;
drop table if exists public.ai_logs cascade;
drop table if exists public.automations cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.agents cascade;
drop table if exists public.llm_providers cascade;
drop table if exists public.notifications cascade;
drop table if exists public.instance_index cascade;
drop table if exists public.instances cascade;
drop table if exists public.invites cascade;
drop table if exists public.tenant_members cascade;
drop table if exists public.master_admins cascade;
drop table if exists public.users cascade;
drop table if exists public.tenants cascade;

-- Tabelas novas/adicionais
drop table if exists public.templates cascade;
drop table if exists public.scheduled_messages cascade;
drop table if exists public.invoices cascade;
drop table if exists public.billing_intents cascade;
drop table if exists public.audit cascade;
drop table if exists public.campaign_recipients cascade;
drop table if exists public.campaigns cascade;

-- =====================================================
-- PASSO 2: RECRIAR TABELAS COM ESTRUTURA CORRETA
-- =====================================================

-- 1. Tenants (Workspaces)
create table public.tenants (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  "ownerId" text not null,
  plan text default 'trial',
  status text default 'active',
  "createdAt" timestamptz default now(),
  "onboardedAt" timestamptz,
  "evolutionApiUrl" text,
  "evolutionApiKey" text,
  "lastPaymentAt" timestamptz,
  "billingProvider" text,
  updated_at timestamptz default now()
);

-- 2. Master Admins
create table public.master_admins (
  id uuid primary key,
  created_at timestamptz default now()
);

-- 3. Users (Perfis de usuário)
create table public.users (
  uid uuid primary key,
  email text,
  "displayName" text,
  "tenantId" text references public.tenants(id) on delete set null,
  role text default 'agent',
  updated_at timestamptz default now()
);

-- 4. Tenant Members
create table public.tenant_members (
  uid uuid not null,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  email text,
  "displayName" text,
  role text default 'agent',
  "joinedAt" timestamptz default now(),
  primary key (uid, "tenantId")
);

-- 5. Invites
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  role text default 'agent',
  "createdAt" timestamptz default now()
);

-- 6. Instances (WhatsApp)
create table public.instances (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  name text not null,
  status text default 'offline',
  "updatedAt" timestamptz default now()
);

-- 7. Instance Index (busca rápida no Webhook)
create table public.instance_index (
  "instanceName" text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade
);

-- 8. Conversations
create table public.conversations (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "instanceName" text not null,
  "contactName" text,
  "contactPhone" text,
  "remoteJid" text not null,
  "lastMessage" text,
  "updatedAt" timestamptz default now(),
  status text default 'aberta',
  unread integer default 0,
  "botPaused" boolean default false,
  tags jsonb default '[]'::jsonb
);

-- 9. Messages
create table public.messages (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "conversationId" text not null references public.conversations(id) on delete cascade,
  text text,
  "fromMe" boolean default false,
  bot boolean default false,
  "agentId" text,
  "createdAt" timestamptz default now(),
  automation text
);

-- 10. LLM Providers
create table public.llm_providers (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  kind text not null,
  name text not null,
  "apiKey" text,
  "baseUrl" text,
  models jsonb default '[]'::jsonb,
  "createdAt" timestamptz default now()
);

-- 11. Agents
create table public.agents (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  name text not null,
  "whatsappInstanceId" text,
  "autoReply" boolean default true,
  "providerId" text references public.llm_providers(id) on delete set null,
  model text,
  "systemPrompt" text,
  temperature numeric default 0.5,
  "createdAt" timestamptz default now(),
  "photoUrl" text,
  category text default 'Geral',
  department text default 'Atendimento',
  description text,
  status text default 'offline',
  segment text default 'Vendas',
  "promptVersion" integer default 1,
  "topP" numeric default 1,
  "maxTokens" integer default 1024,
  memory text default 'vetorial',
  persona jsonb default '{}'::jsonb,
  "messages30d" integer default 0,
  "conversions30d" integer default 0,
  "_createdBy" text
);

-- 12. Knowledge (Bases RAG)
create table public.knowledge (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "embedProviderId" text,
  "embedModel" text,
  name text,
  "createdAt" timestamptz default now()
);

-- 13. Knowledge Chunks
create table public.knowledge_chunks (
  id text primary key default gen_random_uuid()::text,
  "knowledgeId" text not null references public.knowledge(id) on delete cascade,
  text text not null,
  embedding jsonb
);

-- 14. Automations
create table public.automations (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  name text not null,
  enabled boolean default true,
  "matchType" text default 'contains',
  pattern text,
  "caseSensitive" boolean default false,
  actions jsonb default '[]'::jsonb,
  "order" integer default 0
);

-- 15. AI Logs
create table public.ai_logs (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "createdAt" timestamptz default now(),
  "agentId" text,
  "agentName" text,
  "providerId" text,
  "providerKind" text,
  model text,
  "instanceName" text,
  "remoteJid" text,
  "conversationId" text,
  "userText" text,
  reply text,
  "systemPromptChars" integer,
  "latencyMs" integer,
  ok boolean default true,
  error text
);

-- 16. Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null references public.tenants(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  severity text default 'info',
  link text,
  read boolean default false,
  "createdAt" timestamptz default now()
);

-- 17. Templates
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null references public.tenants(id) on delete cascade,
  shortcut text not null,
  title text,
  body text not null,
  unique (shortcut, "tenantId")
);

-- 18. Scheduled Messages
create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "instanceName" text not null,
  number text not null,
  text text not null,
  "scheduledAt" timestamptz not null,
  status text default 'pending',
  "sentAt" timestamptz,
  error text,
  "createdBy" text,
  "createdAt" timestamptz default now()
);

-- 19. Invoices
create table public.invoices (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  provider text,
  "externalId" text,
  "planId" text,
  amount numeric,
  "netValue" numeric,
  status text,
  "billingType" text,
  "invoiceUrl" text,
  "dueDate" date,
  "paidAt" timestamptz,
  event text,
  "updatedAt" timestamptz default now()
);

-- 20. Billing Intents
create table public.billing_intents (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  provider text,
  "planId" text,
  "externalId" text,
  status text,
  amount numeric,
  url text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

-- 21. Audit (Log de Auditoria)
create table public.audit (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null references public.tenants(id) on delete cascade,
  action text not null,
  target text,
  "targetLabel" text,
  "actorId" text,
  "actorEmail" text,
  "actorName" text,
  meta jsonb,
  "createdAt" timestamptz default now()
);

-- =====================================================
-- PASSO 3: HABILITAR RLS EM TODAS AS TABELAS
-- =====================================================
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.tenant_members enable row level security;
alter table public.master_admins enable row level security;
alter table public.invites enable row level security;
alter table public.instances enable row level security;
alter table public.instance_index enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.llm_providers enable row level security;
alter table public.agents enable row level security;
alter table public.knowledge enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.automations enable row level security;
alter table public.ai_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.templates enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.invoices enable row level security;
alter table public.billing_intents enable row level security;
alter table public.audit enable row level security;

-- =====================================================
-- PASSO 4: POLICIES - Permitir acesso autenticado
-- =====================================================

-- Tenants: qualquer usuário autenticado pode ler e inserir/editar
create policy "tenants_select" on public.tenants for select to authenticated using (true);
create policy "tenants_insert" on public.tenants for insert to authenticated with check (true);
create policy "tenants_update" on public.tenants for update to authenticated using (true) with check (true);
create policy "tenants_delete" on public.tenants for delete to authenticated using (true);

-- Users
create policy "users_select" on public.users for select to authenticated using (true);
create policy "users_insert" on public.users for insert to authenticated with check (true);
create policy "users_update" on public.users for update to authenticated using (true) with check (true);
create policy "users_delete" on public.users for delete to authenticated using (true);

-- Tenant Members
create policy "tm_select" on public.tenant_members for select to authenticated using (true);
create policy "tm_insert" on public.tenant_members for insert to authenticated with check (true);
create policy "tm_update" on public.tenant_members for update to authenticated using (true) with check (true);
create policy "tm_delete" on public.tenant_members for delete to authenticated using (true);

-- Master Admins
create policy "ma_select" on public.master_admins for select to authenticated using (true);
create policy "ma_insert" on public.master_admins for insert to authenticated with check (true);

-- Invites
create policy "inv_select" on public.invites for select to authenticated using (true);
create policy "inv_insert" on public.invites for insert to authenticated with check (true);
create policy "inv_delete" on public.invites for delete to authenticated using (true);

-- Instances
create policy "inst_all" on public.instances for all to authenticated using (true) with check (true);

-- Instance Index
create policy "idx_all" on public.instance_index for all to authenticated using (true) with check (true);

-- Conversations
create policy "conv_all" on public.conversations for all to authenticated using (true) with check (true);

-- Messages
create policy "msg_all" on public.messages for all to authenticated using (true) with check (true);

-- LLM Providers
create policy "prov_all" on public.llm_providers for all to authenticated using (true) with check (true);

-- Agents
create policy "ag_all" on public.agents for all to authenticated using (true) with check (true);

-- Knowledge
create policy "know_all" on public.knowledge for all to authenticated using (true) with check (true);

-- Knowledge Chunks
create policy "kc_all" on public.knowledge_chunks for all to authenticated using (true) with check (true);

-- Automations
create policy "auto_all" on public.automations for all to authenticated using (true) with check (true);

-- AI Logs
create policy "logs_all" on public.ai_logs for all to authenticated using (true) with check (true);

-- Notifications
create policy "notif_all" on public.notifications for all to authenticated using (true) with check (true);

-- Templates
create policy "temp_all" on public.templates for all to authenticated using (true) with check (true);

-- Scheduled Messages
create policy "sched_all" on public.scheduled_messages for all to authenticated using (true) with check (true);

-- Invoices
create policy "invs_all" on public.invoices for all to authenticated using (true) with check (true);

-- Billing Intents
create policy "bi_all" on public.billing_intents for all to authenticated using (true) with check (true);

-- Audit
create policy "aud_all" on public.audit for all to authenticated using (true) with check (true);

-- Campaigns
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null references public.tenants(id) on delete cascade,
  name text not null,
  "instanceName" text not null,
  "messageText" text not null,
  "mediaUrl" text,
  "mediaType" text,
  status text not null default 'draft',
  "minDelay" integer not null default 15,
  "maxDelay" integer not null default 45,
  "createdAt" timestamptz default now()
);

-- Campaign Recipients
create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  "campaignId" uuid not null references public.campaigns(id) on delete cascade,
  number text not null,
  name text,
  status text not null default 'pending',
  "sentAt" timestamptz,
  error text
);

-- Habilitar RLS nas novas tabelas
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;

-- Criar políticas para autenticados
create policy "camp_all" on public.campaigns for all to authenticated using (true) with check (true);
create policy "camp_rec_all" on public.campaign_recipients for all to authenticated using (true) with check (true);

-- Criar o bucket de storage para mídias de campanha
insert into storage.buckets (id, name, public) values ('campaigns', 'campaigns', true) on conflict (id) do nothing;

-- Criar políticas para o storage do bucket campaigns
drop policy if exists "storage_campaigns_insert" on storage.objects;
drop policy if exists "storage_campaigns_select" on storage.objects;
drop policy if exists "storage_campaigns_delete" on storage.objects;

create policy "storage_campaigns_insert" on storage.objects for insert to authenticated with check (bucket_id = 'campaigns');
create policy "storage_campaigns_select" on storage.objects for select to public using (bucket_id = 'campaigns');
create policy "storage_campaigns_delete" on storage.objects for delete to authenticated using (bucket_id = 'campaigns');

-- =====================================================
-- PASSO 4.5: TABELA DE AGENDAMENTOS (APPOINTMENTS)
-- =====================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "patientName" text not null,
  "patientPhone" text not null,
  specialty text not null,
  "date" date not null,
  "time" text not null,
  status text default 'scheduled', -- 'scheduled', 'cancelled'
  "createdAt" timestamptz default now()
);

alter table public.appointments enable row level security;
create policy "appointments_all" on public.appointments for all to authenticated using (true) with check (true);

-- =====================================================
-- PASSO 4.75: ÍNDICES DE PERFORMANCE DO BANCO DE DADOS
-- =====================================================
create index if not exists idx_conversations_tenant_updated on public.conversations ("tenantId", "updatedAt" desc);
create index if not exists idx_messages_conversation_created on public.messages ("conversationId", "createdAt" asc);
create index if not exists idx_ai_logs_tenant_created on public.ai_logs ("tenantId", "createdAt" desc);
create index if not exists idx_appointments_tenant_date on public.appointments ("tenantId", "date" asc);
create index if not exists idx_knowledge_chunks_knowledge on public.knowledge_chunks ("knowledgeId");

-- =====================================================
-- PASSO 5: RECARREGAR CACHE DO SCHEMA
-- =====================================================
notify pgrst, 'reload schema';



-- =====================================================
-- PASSO 6: HABILITAR REALTIME NAS TABELAS
-- =====================================================
-- Drop publication to avoid errors if it already exists, or just alter it.
begin;
drop publication if exists supabase_realtime;
create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.agents;
alter publication supabase_realtime add table public.llm_providers;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.instances;
alter publication supabase_realtime add table public.knowledge;

