# LYVOIRA audit results (24 Oct 2026)

## What was checked
- Source tree and environment variable references; no embedded project-specific `*.supabase.co` URL or secret token found by text search.
- Supabase SQL export: 15 tables, 122 columns, primary/foreign keys, indexes, identity column and `vector(1536)`.
- All 25 API route files inspected by automated search; selected high-risk routes manually reviewed.
- JS syntax and local relative-import checks.

## Changes in this package
- Widget URL is derived from hosting script instead of hard-coded `lyvoira.com`.
- Admin cookies have signed expiration and timing-safe verification; unified admin guards.
- Admin guards added to stats, policies admin/index/embed and claim event endpoints.
- Private file endpoints require admin; forged `user_id` is no longer accepted as proof of ownership.
- Upload file count, size and MIME restrictions; signed URL lifetime shortened.
- Environment configuration checker and fresh database setup instructions.

## NOT VERIFIED / STILL BLOCKING PUBLIC RELEASE
- npm install/build unavailable in this environment (dependency fetch failed); no actual Next.js build or browser tests.
- No live Supabase or OpenAI keys; no end-to-end test of database, Storage, AI chat or email.
- `messages` uses anonymous Supabase access: restrictive RLS may block message saving/reading; needs authenticated user identity and scoped policies or a secure backend redesign.
- Product search and orders verification require functional tests; exported database contains no `orders` table.
- Uploaded files are not bound to authenticated ownership and there is no durable distributed rate limiter.
- Service-role API routes not listed above require individual authorization tests.
- SQL was reconstructed from exports and not executed against a fresh Supabase project.
- Storage access policies and demo seed data are incomplete.

**This is an improved review build, NOT a guaranteed production-ready release.**
