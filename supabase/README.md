# Supabase setup (reconstructed schema)

1. Create a **new empty** Supabase project. Never run `schema.sql` on the original project.
2. Open SQL Editor and run `schema.sql`. It creates the 17 tables, primary/foreign/unique keys, indexes, `vector(1536)` and five Storage buckets.
3. Configure your own credentials in `.env.local` from `.env.example`. Do not commit secrets.
4. Storage buckets are **private by default**; the original had `chat-files` and `evidence` public. Implement appropriate policies or signed URLs.
5. RLS is enabled without anon/auth policies for safety. Audit client access and server-side auth before expecting all flows to work.

**Not yet verified:** integration tests, SQL functions/triggers, exact original sequence configuration, storage policies, seed data, API authentication, and original RLS rules. The `claim_events` and `claims_photo` integer IDs use `bigserial` as an equivalent auto-increment bootstrap rather than recreating the original sequences verbatim.
