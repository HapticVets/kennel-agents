-- Hosted admin access control table.
-- Run this in Supabase SQL editor before using hosted kennel-agents admin auth.

create table if not exists public.kennel_admins (
  id bigint generated always as identity primary key,
  auth_uid uuid not null unique references auth.users(id) on delete cascade,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists kennel_admins_auth_uid_idx
  on public.kennel_admins(auth_uid);

create index if not exists kennel_admins_is_active_idx
  on public.kennel_admins(is_active);
