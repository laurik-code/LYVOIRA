> **Setup status:** Supabase schema reconstructed from exported metadata. Fresh-install functionality and security are not yet end-to-end tested. See [Supabase setup](supabase/README.md).

> **Setup status:** Supabase schema reconstructed from exported metadata. Fresh-install functionality and security are not yet end-to-end tested. See [Supabase setup](supabase/README.md).

# LYVOIRA

**AI-assisted e-commerce customer support and claims management — portfolio prototype**

LYVOIRA is a Next.js application exploring AI customer support, customer/admin messaging, product and order lookups, returns/claims management, policy retrieval with embeddings, and file attachments. It uses OpenAI and Supabase (PostgreSQL + Storage). The code is an **experimental portfolio project**, not a production-ready hosted service.

> **Security warning:** This repository is not currently safe to deploy to the public internet. Some API routes use privileged Supabase credentials without adequate authentication or authorization. Review [SECURITY.md](SECURITY.md) before exposing any endpoints.

## Features present in source code

- Customer-facing chat and claim submission pages
- Admin interface for claims, messages, policies and analytics
- OpenAI-powered chat and policy embeddings / retrieval logic
- Supabase-backed messages, claims, order/product lookups, and file uploads
- Slovak/English UI elements

These features have been identified in source code, **not verified by a complete end-to-end test**.

## Tech stack

Next.js 14 (App Router), React 18, JavaScript, Tailwind CSS, OpenAI API, Supabase JavaScript client, PostgreSQL via Supabase, Supabase Storage, optional Resend integration.

## Prerequisites

- Node.js and npm (use a supported Node.js LTS release compatible with Next.js 14)
- A **separate test** Supabase project
- Your own OpenAI API key with available credits, for AI functionality
- An admin password of your own
- Optionally a Resend API key for email features

## Local installation

```bash
git clone <YOUR-NEW-REPOSITORY-URL>
cd <YOUR-NEW-REPOSITORY-FOLDER>
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if needed. Open http://localhost:3000.

**Important:** `npm run dev` alone does **not** make the full application functional. Replace placeholders in `.env.local` and configure the database, tables, permissions and storage as described in [docs/SETUP.md](docs/SETUP.md). The reconstructed `supabase/schema.sql` is **not integration-tested**; a clean-room setup cannot yet be guaranteed.

## Environment variables

See [.env.example](.env.example) for names expected by the current code. `NEXT_PUBLIC_*` values are bundled for the browser and must never contain privileged keys. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `ADMIN_PASSWORD`, and `RESEND_API_KEY` must remain private. Some code paths use inconsistent names (`SUPABASE_URL` vs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_KEY` vs `NEXT_PUBLIC_SUPABASE_KEY`); these are intentionally listed until configuration is unified.

## Running without API keys

You can inspect and develop the frontend source, but **the current application does not implement a fully offline/mock mode**. API calls and some server modules may fail without valid Supabase/OpenAI settings. Do not mistake an accessible home page for a working AI/claims demo. A safe mock mode is planned, not implemented.

## Repository structure

- `app/` — customer and admin pages
- `app/api/` — Next.js server routes
- `public/widget.js` — embeddable widget asset
- `docs/` — environment, database and testing guidance

## Verification status

Source structure and configuration have been reviewed. End-to-end tests, production build, live Supabase integrations, email delivery and AI outputs have **not** been verified in this prepared copy. See [docs/TESTING.md](docs/TESTING.md).

## Roadmap

1. Protect all privileged endpoints with server-side authentication and per-resource authorization.
2. Implement and validate SQL migrations, RLS policies and storage permissions.
3. Add input validation, rate limiting and file upload restrictions.
4. Unify environment variable naming and handle missing configuration safely.
5. Add automated tests, CI, and a fully offline demonstration mode.

## License

No license has been granted yet. Add a LICENSE file only after choosing the terms under which others may use this code.
