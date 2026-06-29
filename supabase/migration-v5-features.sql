-- 1. Coluna de Agente na Base de Conhecimento (knowledge)
ALTER TABLE public.knowledge ADD COLUMN IF NOT EXISTS "agentId" text REFERENCES public.agents(id) ON DELETE SET NULL;
