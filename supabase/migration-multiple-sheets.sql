-- Migration: Allow multiple Google Sheets integrations and add title column
-- Execute este script no SQL Editor do console Supabase.

-- 1. Remover a restrição de unicidade para permitir múltiplas planilhas por tenant
ALTER TABLE google_integrations DROP CONSTRAINT IF EXISTS "google_integrations_tenantId_serviceType_key";

-- 2. Adicionar coluna title se ela não existir
ALTER TABLE google_integrations ADD COLUMN IF NOT EXISTS "title" TEXT;
