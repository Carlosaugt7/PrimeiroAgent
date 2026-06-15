-- Migration: Planos, Limites Customizados e Expiração
-- Execute este script no SQL Editor do Supabase para atualizar a tabela tenants

-- 1. Adicionar novas colunas se não existirem
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "maxAgents" INTEGER DEFAULT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "maxMessages" INTEGER DEFAULT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "maxInstances" INTEGER DEFAULT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "enabledFeatures" TEXT[] DEFAULT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "phone" TEXT DEFAULT NULL;

-- 2. Inicializar planExpiresAt para workspaces existentes com 14 dias a partir de sua criação (createdAt)
UPDATE public.tenants 
SET "planExpiresAt" = "createdAt" + INTERVAL '14 days' 
WHERE "planExpiresAt" IS NULL;

-- 3. Notificar recarregamento do schema
NOTIFY pgrst, 'reload schema';
