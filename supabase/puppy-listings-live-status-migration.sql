-- Run this once on existing Supabase projects that were created before
-- the puppy workflow switched from placement/deploy states to live_on_site.

alter table public.puppy_listings
  drop constraint if exists puppy_listings_status_check;

alter table public.puppy_listings
  add constraint puppy_listings_status_check
  check (
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
  );
