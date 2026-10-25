# Security status — action required

**Do not publicly deploy this version or connect it to real customer data.**

The following issues were identified from source review and are **not yet remediated**:

1. `app/api/stats/route.js` returns claim analytics and example contact details without admin authentication.
2. `app/api/file/[bucket]/[key]/route.js` uses privileged Supabase Storage access without checking request authorization.
3. `app/api/policies/admin/get/route.js` and `app/api/policies/admin/save/route.js` do not authenticate admin access; the latter modifies policy content and calls OpenAI.
4. `app/api/messages/route.js` uses a caller-provided `user_id` for reads. Without a trustworthy identity bound to that ID, access control depends on database RLS behavior.
5. `app/api/upload/route.js` accepts public uploads with no explicit size/type limits or user authorization, returning long-lived signed URLs.
6. Several API routes have no explicit rate limits. Admin cookie signature validation should be centralized and hardened; the signature is not an adequate substitute for authorization checks on every privileged endpoint.

The old `messages-debug`, `test`, and `troubleshoot` routes and debug UI were **removed from this prepared copy**, but this is not a substitute for the fixes above.

## Secret handling

- Never commit `.env.local`, service role keys, OpenAI keys, Resend keys or passwords.
- Use a dedicated test Supabase project and test-only data.
- If any secret was previously committed to a public GitHub repository, rotate/revoke it even if the file was later deleted.
- Never use a Supabase service role key in browser code or a `NEXT_PUBLIC_*` variable.

## Before production

Implement route-by-route authentication and authorization, database RLS, safe upload limits, rate limiting, secret rotation, test coverage and dependency auditing. Review `app/api/[...path]/route.js` and all remaining API routes separately. This list is **not a complete security certification**.
