-- First web-ready puppy listing schema.
-- Run this in Supabase SQL editor before enabling the Supabase puppy store env vars.

create table if not exists public.puppy_listings (
  id text primary key,
  batch_id text not null,
  status text not null check (
    status in (
      'draft',
      'approved',
      'ready_for_placement',
      'applied',
      'deployed',
      'live_on_site',
      'active_on_site',
      'sold_or_reserved',
      'archived'
    )
  ),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  puppy_name text not null,
  sex text not null,
  age text not null,
  litter text not null,
  availability text not null check (availability in ('available', 'reserved', 'sold')),
  temperament_notes text not null,
  breeder_notes text not null,
  price_or_deposit text,
  listing_title text not null,
  short_summary text not null,
  full_description text not null,
  homepage_card_copy text not null,
  suggested_slug text not null
);

create table if not exists public.puppy_listing_meta (
  key text primary key,
  value text not null
);

create table if not exists public.puppy_listing_images (
  id text primary key,
  listing_id text references public.puppy_listings(id) on delete set null,
  file_name text not null,
  public_url text not null,
  alt_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists puppy_listings_status_idx on public.puppy_listings(status);
create index if not exists puppy_listing_images_listing_id_idx on public.puppy_listing_images(listing_id);
