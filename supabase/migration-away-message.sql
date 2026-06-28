-- Migration: Add awayMessage column to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "awayMessage" text;
