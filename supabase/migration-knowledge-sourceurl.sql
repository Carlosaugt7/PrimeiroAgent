-- Migration: add sourceUrl column to knowledge table
-- Run this in Supabase SQL editor

alter table public.knowledge
  add column if not exists "sourceUrl" text;
