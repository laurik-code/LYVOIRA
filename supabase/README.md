# Supabase setup (reconstructed schema)

1. Create a **new empty** Supabase project. Never run `schema.sql` on the original project.
2. Open SQL Editor and run `schema.sql`. It creates the 17 tables, primary/foreign/unique keys, indexes, `vector(1536)` and five Storage buckets.
3. Configure your own credentials in `.env.local` from `.env.example`. Do not commit secrets.
4. Storage buckets are **private by default**; the original had `chat-files` and `evidence` public. Implement appropriate policies or signed URLs.
5. RLS is enabled without anon/auth policies for safety. Audit client access and server-side auth before expecting all flows to work.

**Not yet verified:** integration tests, SQL functions/triggers, exact original sequence configuration, storage policies, seed data, API authentication, and original RLS rules. The `claim_events` and `claims_photo` integer IDs use `bigserial` as an equivalent auto-increment bootstrap rather than recreating the original sequences verbatim.


## Shop ID configuration (required for AI chat)

1. Create a shop record in the `public.shops` table in your test Supabase project.
2. Copy its `id` (UUID) into `NEXT_PUBLIC_SHOP_ID` in `.env.local`.
3. Restart `npm run dev` after editing `.env.local`.
4. An explicitly configured `lyvoira_shop_id` in browser localStorage takes precedence for widget/shop-specific flows.

Do **not** reuse the UUID of the original development shop. This setting is a public identifier, not a secret.

**Known limitation:** `supabase/schema.sql` does not currently define an `orders` table, although `/api/orders/verify` queries one. Order verification requires the actual orders schema and appropriate access policies; it is not part of a verified clean-room setup.

**Known limitation:** `supabase/schema.sql` enables RLS without supplying a complete set of customer access policies. The current anonymous message endpoints may fail on a fresh installation. Do not disable RLS to make them work; this needs a deliberate authorization design and testing.
