-- =====================================================
-- AgentHub AI: SCRIPT DE CORREÇÃO - Agente Offline
-- =====================================================
-- Execute este script no SQL Editor do Supabase para:
-- 1. Garantir que a coluna autoReply existe e está ativa
-- 2. Sincronizar o status do agente com a instância conectada
-- 3. Verificar se o instance_index está correto
-- =====================================================

-- PASSO 1: Garantir que a coluna autoReply existe
-- (se já existe, o ALTER TABLE é ignorado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'autoReply'
  ) THEN
    ALTER TABLE public.agents ADD COLUMN "autoReply" boolean DEFAULT true;
    RAISE NOTICE '✅ Coluna autoReply criada com sucesso';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna autoReply já existe';
  END IF;
END $$;

-- PASSO 2: Ativar autoReply em todos os agentes que estão NULL
UPDATE public.agents
SET "autoReply" = true
WHERE "autoReply" IS NULL;

-- PASSO 3: Sincronizar o status dos agentes com as instâncias conectadas
-- Se a instância vinculada está "online", o agente também fica "online"
UPDATE public.agents a
SET status = i.status
FROM public.instances i
WHERE a."whatsappInstanceId" = i.name
  AND a."tenantId" = i."tenantId"
  AND i.status = 'online'
  AND a.status != 'online';

-- PASSO 4: Verificação — Listar agentes e seus status para conferir
SELECT
  a.id AS agent_id,
  a.name AS agent_name,
  a.status AS agent_status,
  a."autoReply",
  a."whatsappInstanceId",
  a."providerId",
  a.model,
  i.name AS instance_name,
  i.status AS instance_status,
  idx."instanceName" AS index_entry
FROM public.agents a
LEFT JOIN public.instances i
  ON i.name = a."whatsappInstanceId"
  AND i."tenantId" = a."tenantId"
LEFT JOIN public.instance_index idx
  ON idx."instanceName" = a."whatsappInstanceId"
ORDER BY a."createdAt" DESC;

-- PASSO 5: Verificar se há instâncias sem registro no instance_index
-- (sem esse registro, o webhook não sabe para qual tenant enviar)
SELECT
  i.id,
  i.name,
  i."tenantId",
  i.status,
  idx."instanceName" AS index_exists
FROM public.instances i
LEFT JOIN public.instance_index idx
  ON idx."instanceName" = i.name
WHERE idx."instanceName" IS NULL;

-- Se o PASSO 5 retornar linhas, significa que há instâncias
-- sem registro no instance_index. Execute o INSERT abaixo
-- descomentando e substituindo os valores:
--
-- INSERT INTO public.instance_index ("instanceName", "tenantId")
-- VALUES ('NOME_DA_INSTANCIA', 'ID_DO_TENANT');
