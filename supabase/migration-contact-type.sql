-- Migration: Add contactType to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "contactType" text;
