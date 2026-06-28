-- 1. Coluna de Pontuação de Leads no CRM
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "leadScore" integer;

-- 2. Coluna para detectar se o RAG falhou
ALTER TABLE public.ai_logs ADD COLUMN IF NOT EXISTS "ragSuccess" boolean DEFAULT true;
