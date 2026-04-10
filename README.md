# Kennel Agent System

Next.js admin dashboard for kennel operations and agent-assisted site review.

## Current Hosting Model

- Puppy listings are web-ready and use Supabase as the source of truth.
- Admin access is protected by the dashboard login and a signed HTTP-only session cookie.
- SEO/content tools still use local JSON files and local website-repo paths, so keep those as local/operator tools until they are migrated separately.

## Vercel Setup

1. Create a Vercel project from this repository.
2. Use the default Next.js settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output: Next.js default
3. Add these Vercel environment variables for Production, Preview, and Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PUPPY_IMAGE_BUCKET=puppy-listings`
   - `ADMIN_SESSION_SECRET`
   - `ADMIN_ALLOWED_EMAILS=you@example.com,partner@example.com`
   - `KENNEL_HEALTH_DEBUG=false`
4. In Supabase Auth, create the admin user that should be allowed to log in.
   - When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, `/admin/login` uses Supabase Auth email/password.
   - `ADMIN_SESSION_SECRET` should be a long random string used only to sign the dashboard session cookie.
   - `ADMIN_ALLOWED_EMAILS` is the comma-separated allowlist for you and your kennel partner; authenticated Supabase users outside this list are rejected.
5. Confirm the Supabase tables and storage bucket exist:
   - `puppy_listings`
   - `puppy_listing_images`
   - `puppy_listing_meta`
   - public storage bucket named by `SUPABASE_PUPPY_IMAGE_BUCKET`
6. Deploy, then open `/admin/login` and sign in with the Supabase admin email/password.

## Production Notes

- In production, puppy listing storage requires Supabase. The app intentionally does not fall back to local SQLite or local images on Vercel.
- `/api/public/puppy-listings` remains public so the website can read live puppy inventory.
- Dashboard APIs are protected by middleware, except the login route and public puppy listing/image reads.
- The release/deploy agents still assume local filesystem and git access to `C:\Users\jrees\das-muller-website`; do not treat those as production-hosted workflows yet.

## Local Development

```bash
npm install
npm run dev
```

For local puppy listing development, copy `.env.example` to `.env.local` and fill in the Supabase values.
