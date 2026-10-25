# Testing checklist

## Checks already performed

- Source and package manifest inspected.
- Sensitive file/folder exclusions checked in provided ZIP.
- API routes inspected for key authorization gaps.

## Not yet completed

- [ ] `npm ci` from a clean environment
- [ ] `npm run build` with safe test configuration
- [ ] App starts with `npm run dev`
- [ ] AI chat answers with own OpenAI test key
- [ ] Policy upload, embedding and retrieval with seeded policy
- [ ] Customer message persists and displays correctly
- [ ] User cannot read another user's messages
- [ ] Claim submission with required fields and attachment
- [ ] Claim events/status update
- [ ] Admin login, logout and session expiry
- [ ] Unauthenticated users cannot access ANY admin APIs
- [ ] File proxy rejects unauthorized bucket/key access
- [ ] File upload rejects oversized/disallowed files
- [ ] Orders and products queries work against seeded test tables
- [ ] Optional email integration works in test mode
- [ ] Database RLS denies unauthorized operations
- [ ] Dependency audit and GitHub CI

Use **only synthetic test records**. Record pass/fail with date, environment, and response. This file is a plan, not evidence of passing tests.
