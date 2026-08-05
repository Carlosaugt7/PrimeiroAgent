-- ============================================================
-- MIGRATION: Delivery Tracking para WhatsApp
-- Data: 2026-08-05
-- Objetivo: Rastrear falhas no envio de respostas para WhatsApp
-- ============================================================

-- 1. NOVAS COLUNAS EM ai_logs para rastrear status de entrega WhatsApp
alter table public.ai_logs
  add column if not exists "deliveryStatus" text default 'pending',
  add column if not exists "deliveryError" text,
  add column if not exists "deliveryLatencyMs" integer,
  add column if not exists "deliveryAttempts" integer default 0,
  add column if not exists "whatsappMessageId" text,
  add column if not exists "inputTokens" integer default 0,
  add column if not exists "outputTokens" integer default 0,
  add column if not exists "ragSuccess" boolean default true;

comment on column public.ai_logs."deliveryStatus" is 'pending | sent | failed | delivered';
comment on column public.ai_logs."deliveryError" is 'Erro do Evolution API ou WhatsApp no envio';
comment on column public.ai_logs."deliveryLatencyMs" is 'Tempo gasto na chamada de envio ao Evolution API';
comment on column public.ai_logs."deliveryAttempts" is 'Numero de tentativas de envio';
comment on column public.ai_logs."whatsappMessageId" is 'ID da mensagem retornado pelo Evolution API';

-- 2. NOVAS COLUNAS EM messages para sincronizar status de entrega
alter table public.messages
  add column if not exists "whatsappMessageId" text,
  add column if not exists "deliveryStatus" text default 'sent',
  add column if not exists "deliveryError" text;

create index if not exists idx_messages_delivery_failed
  on public.messages ("tenantId", "createdAt" desc)
  where "deliveryStatus" = 'failed';

-- 3. TABELA delivery_failures - para dashboards e alertas
create table if not exists public.delivery_failures (
  id text primary key default gen_random_uuid()::text,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "createdAt" timestamptz default now(),
  "instanceName" text not null,
  "remoteJid" text not null,
  "conversationId" text,
  "agentId" text,
  "logId" text references public.ai_logs(id) on delete set null,
  "errorType" text,
  "errorMessage" text,
  "httpStatus" integer,
  "rawResponse" text,
  "retryCount" integer default 0,
  "resolved" boolean default false,
  "resolvedAt" timestamptz,
  "notificationSent" boolean default false
);

create index if not exists idx_delivery_failures_tenant_created
  on public.delivery_failures ("tenantId", "createdAt" desc);

create index if not exists idx_delivery_failures_unresolved
  on public.delivery_failures ("tenantId", "resolved") where resolved = false;

-- 4. VIEW para monitoramento - falhas nao resolvidas por instancia
create or replace view public.v_delivery_health as
select
  "tenantId",
  "instanceName",
  count(*) as failures_last_24h,
  count(*) filter (where "resolved" = false) as unresolved,
  min("createdAt") as first_failure_at,
  max("createdAt") as last_failure_at
from public.delivery_failures
where "createdAt" >= now() - interval '24 hours'
group by "tenantId", "instanceName";

-- 5. POLICIES
alter table public.delivery_failures enable row level security;

create policy if not exists "delivery_failures_all"
  on public.delivery_failures for all to authenticated
  using (true) with check (true);

-- 6. Funcao auxiliar para classificar tipo de erro
create or replace function public.classify_delivery_error(error_msg text)
returns text as $$
begin
  if error_msg is null then return 'unknown'; end if;
  if error_msg ~* '401|403|auth|api.?key|apikey' then return 'authentication'; end if;
  if error_msg ~* '404|instanc|not.?found' then return 'instance_not_found'; end if;
  if error_msg ~* '400|invalid.?number|number|numero' then return 'invalid_number'; end if;
  if error_msg ~* '429|rate.?limit|too.?many' then return 'rate_limit'; end if;
  if error_msg ~* '500|502|503|504|unavailable|timeout|econn|network' then return 'server_or_network'; end if;
  if error_msg ~* 'disconnected|not.?connected|close|offline' then return 'instance_disconnected'; end if;
  if error_msg ~* 'blocked|banned|spam|restriction' then return 'whatsapp_restriction'; end if;
  return 'other';
end;
$$ language plpgsql immutable;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
