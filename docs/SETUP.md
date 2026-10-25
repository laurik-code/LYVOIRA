# Supabase and service setup

## 1. Create a separate test Supabase project

Create your own Supabase project. Copy the project URL and its public anon/publishable key into `.env.local`. Keep the service-role/secret key server-side only. Do not reuse the original developer's keys.

## 2. Database inventory from source code

The following tables are referenced in server routes:

| Table | Used for |
| --- | --- |
| `messages` | Chat and admin messages |
| `claims` | Customer claims and admin reporting |
| `claim_events` | Claim status/event history |
| `claim_photo` | Claim attachments metadata |
| `chat_photo` | Chat attachment metadata |
| `orders` | Order verification |
| `products` | Product search |
| `policy_chunks` | Indexed policy text and embeddings |
| `policy_docs` | Policy document metadata |

**A reconstructed SQL schema is now included at `supabase/schema.sql`.** Run it only in a new empty Supabase project. It has not been integration-tested. It recreates exported columns, keys and indexes but not data, external functions or complete access policies. The `orders` table is referenced by code but absent from the supplied database export.

## 3. Storage

The source references private buckets `chat-files-private` and `claim-files-private`. Create them in your test Supabase project with private access. Inspect other dynamic bucket paths before assuming these are the only buckets. Set strict size/type rules and storage access policies. The source currently generates signed URLs that may remain valid for 30 days; shorten that duration for sensitive files.

## 4. Environment

Copy `.env.example` to `.env.local`. Configure your own Supabase, OpenAI, admin password and optional email credentials. Current source uses both public and server-only Supabase key names; see README. Do not expose the service-role key to the browser.

## 5. Run and verify

Run `npm ci`, `npm run check:config` and `npm run dev`. Then follow [TESTING.md](TESTING.md). **The app may fail to build or run with placeholder keys** because some SDK clients are constructed at module import time.

## 6. Missing prerequisites for a reproducible demo

- Tested SQL migrations and seed data
- Verified RLS policies and per-user authorization
- Safe authentication on all admin endpoints
- A no-credentials mock mode or documented seeded test account
- CI build and integration tests

Do not paste secrets into GitHub issues, README, chat messages or screenshots.

## 7. First-run shop record

The exported schema contains no customer/demo records. For chat RAG and products, create a shop in your **new** Supabase SQL Editor:

```sql
insert into public.shops (slug, name) values ('demo', 'Demo Shop') returning id;
```

Use the returned UUID as the shop ID in the app. Never copy an ID from the original database. Public reads/writes are intentionally denied by RLS; browser-side chat persistence and product search may require server-side authorization redesign before working.

## 8. Security and verification limits

Admin cookies now expire cryptographically. Admin-only routes are guarded. Unauthenticated private file access by user_id query string is blocked. This intentionally restricts functionality pending real user authentication. Uploads still need production-grade IP/user rate limits, malware scanning and object ownership. Do not deploy publicly before integration and authorization testing.


## Shop ID configuration (required for AI chat)

1. Create a shop record in the `public.shops` table in your test Supabase project.
2. Copy its `id` (UUID) into `NEXT_PUBLIC_SHOP_ID` in `.env.local`.
3. Restart `npm run dev` after editing `.env.local`.
4. An explicitly configured `lyvoira_shop_id` in browser localStorage takes precedence for widget/shop-specific flows.

Do **not** reuse the UUID of the original development shop. This setting is a public identifier, not a secret.

**Known limitation:** `supabase/schema.sql` does not currently define an `orders` table, although `/api/orders/verify` queries one. Order verification requires the actual orders schema and appropriate access policies; it is not part of a verified clean-room setup.

**Known limitation:** `supabase/schema.sql` enables RLS without supplying a complete set of customer access policies. The current anonymous message endpoints may fail on a fresh installation. Do not disable RLS to make them work; this needs a deliberate authorization design and testing.
