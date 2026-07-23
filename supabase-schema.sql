-- AloraAI clinician sign-ups — Supabase schema.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

create table if not exists public.signups (
  id           bigint generated always as identity primary key,
  name         text not null,
  email        text not null unique,
  organization text,
  location     text,
  linkedin     text,
  created_at   timestamptz not null default now(),
  user_agent   text,
  ip           text
);

-- Keep Row Level Security ON with no public policies. The server talks to
-- Supabase with the service_role key, which bypasses RLS — so ONLY your
-- server can read or write this table. The anon/public key cannot touch it.
alter table public.signups enable row level security;
