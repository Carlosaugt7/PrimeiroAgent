-- Migration: global settings table for platform-wide configurations
-- Run this in Supabase SQL editor

create table if not exists public.global_settings (
  key   text primary key,
  value text
);

-- Seed the Evolution API defaults (update with your real values after running)
insert into public.global_settings (key, value)
values
  ('evolutionApiUrl', 'https://evolution-api.rsconsultoria.pro'),
  ('evolutionApiKey', '')
on conflict (key) do nothing;

-- Only master admins should read/write this table
-- (Add RLS policies if needed for your setup)
