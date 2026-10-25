# LYVOIRA

### AI-Powered E-commerce Customer Support & Claims Management

**Full-stack portfolio project · Next.js · React · Supabase · PostgreSQL · OpenAI**

LYVOIRA is a full-stack web application prototype exploring how AI-assisted conversations, customer support, store policies, and claims submission can work together in an e-commerce environment.

> **Project status:** Functional local portfolio prototype. Selected workflows have been tested with the original development environment. Fresh Supabase installation, full end-to-end testing, and production security hardening are **not yet complete**. This project is not production-ready.

## Overview

LYVOIRA brings several customer-support workflows into one application:

- Customer-facing AI chat and message history
- AI-assisted photo troubleshooting
- Claims submission and administrative review
- Store policy retrieval and editing interface
- Administration dashboard and statistics
- File uploads and Supabase-backed storage
- Experimental embeddable support widget

The goal is to demonstrate full-stack application development, integration with external APIs, relational data modeling, and the practical challenges of connecting AI to business workflows.

## Verified Local Functionality

The following behavior has been observed in the configured development environment:

| Area | Local status |
| --- | --- |
| Next.js development server | Working |
| AI customer-support chat | Working |
| Customer messages and history | Working |
| Admin login and dashboard | Working |
| Admin statistics | Working |
| Image upload | Working |
| AI-assisted photo troubleshooting | Working |
| Claims submission | Working |
| Submitted claims visible in admin | Working |
| Store policy loading in admin | Working |
| Policy editor detects unsaved changes | Working |
| Saving edited store policies | Not yet verified |
| Changing claim status | Not implemented / not working |
| Fresh Supabase setup | Not yet verified |
| External widget installation | Not yet verified |
| Live email delivery | Not yet verified |

These observations do not constitute a complete integration or security test.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19 |
| Language | JavaScript |
| Styling | Tailwind CSS |
| Backend | Next.js App Router API routes |
| Database | PostgreSQL via Supabase |
| Storage | Supabase Storage |
| AI | OpenAI API |
| Database SDK | Supabase JavaScript SDK |
| Email integrations | Nodemailer, Resend (configuration required) |
| Package manager | npm |
| Version control | Git and GitHub |

## Main Features

### AI Customer Support Chat

The customer-facing chat communicates with server-side API routes, stores messages, and generates AI-assisted responses. The application includes integration points for product, order, and store-policy information.

Key files include:

- `app/chat/page.js`
- `app/api/chat/route.js`
- `app/api/messages/route.js`
- `app/api/intent/route.js`
- `app/api/welcome/route.js`

Customer identifiers used by this prototype must not be considered secure authentication.

### AI-Assisted Photo Troubleshooting

Customers can upload a photo for AI-assisted assessment. The local `/api/troubleshoot` workflow has been tested after restoring its route implementation. AI output is advisory and should not be treated as a definitive product diagnosis or claims decision.

### Claims Submission

Customers can submit claims, and submitted records can be viewed in the admin area. **Claim status changes are not a completed feature.** The end-to-end claims lifecycle remains unfinished.

Relevant files include:

- `app/claims/page.js`
- `app/api/claim/route.js`
- `app/api/admin-claims/route.js`

### Administration

The application includes an admin login, dashboard, message views, claim records, and statistics. Admin functionality is demonstrated locally; consistent server-side authorization across privileged routes still needs review.

### Store Policies and AI Retrieval

The policy administration page loads policy content for the configured shop and allows editing. Loading and detecting unsaved changes have been tested locally; saving has **not** yet been verified.

The backend contains policy management and embedding-related routes, including:

- `app/api/policies/admin/get/route.js`
- `app/api/policies/admin/save/route.js`
- `app/api/policies/embed/route.js`
- `app/api/policies/index/route.js`
- `app/api/policies/query/route.js`

The complete embedding and retrieval pipeline has not been validated on a fresh database.

### Files, Widget, and Email

Supabase Storage supports file-handling workflows; local image upload has been tested. The repository also includes `public/widget.js` for an embeddable support widget and dependencies for email delivery. External widget compatibility and live email delivery have not been verified.

## Architecture

```text
Customer interface (Chat / Claims / Widget)
                  |
                  v
             Next.js App
                  |
                  v
              API Routes
              /   |    \
             v    v     v
          OpenAI Supabase Email providers
                  ^
                  |
             Admin interface
```

Frontend pages and React components handle user interaction. Next.js API routes coordinate server-side logic and external integrations. Supabase provides PostgreSQL storage for application data and file storage.

## Repository Structure

```text
LYVOIRA/
├── app/
│   ├── admin/             # Administration pages
│   ├── api/               # Backend API routes
│   ├── chat/              # Customer chat
│   ├── claims/            # Claims submission
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── docs/
│   ├── SETUP.md
│   └── TESTING.md
├── lib/                   # Shared utilities and auth helpers
├── public/
│   └── widget.js
├── scripts/
│   └── check-config.mjs
├── supabase/
│   ├── schema.sql         # Database structure
│   └── seed.sql           # Fictional demo records
├── .env.example
├── .gitignore
├── README.md
├── SECURITY.md
├── package.json
└── package-lock.json
```

The tree is abbreviated and may not list every file in the repository.

## Getting Started

### Prerequisites

- Node.js version compatible with Next.js 16
- npm
- A **new, empty** Supabase project for testing
- An OpenAI API key with available credits
- A strong administrator password
- Optional email provider credentials

**Do not connect this prototype to real customer data.** OpenAI API usage may incur charges.

### 1. Clone the repository

```bash
git clone https://github.com/laurik-code/LYVOIRA.git
cd LYVOIRA
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Create local environment configuration

Windows Command Prompt:

```cmd
copy .env.example .env.local
```

macOS / Linux:

```bash
cp .env.example .env.local
```

Edit `.env.local` and replace the placeholder values with credentials from your own services.

Example variable names:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD
NEXT_PUBLIC_SHOP_ID=11111111-1111-4111-8111-111111111111
```

Other optional or feature-specific variables are documented in `.env.example`.

**Never commit `.env.local` or real credentials.** Never put service-role keys, OpenAI keys, or passwords in variables prefixed with `NEXT_PUBLIC_`.

### 4. Prepare a fresh Supabase database

1. Create a separate Supabase test project.
2. Open the **SQL Editor** in the Supabase dashboard.
3. Review and execute `supabase/schema.sql` to create the database structure.
4. Review and execute `supabase/seed.sql` to insert fictional demonstration records.
5. Confirm that `NEXT_PUBLIC_SHOP_ID` in `.env.local` matches the demo shop ID:

   ```text
   11111111-1111-4111-8111-111111111111
   ```

6. Configure any additional database and Storage access policies required by the endpoints being tested.

**Important:** The schema was reconstructed from database metadata, and this fresh-install sequence has **not been integration-tested**. The schema enables restrictive Row Level Security (RLS) and creates private Storage buckets by default. Some application functionality may fail until access policies and server-side authorization are correctly configured. Do **not** disable RLS globally as a shortcut.

The demo seed inserts a fictional shop, basic policy text, a policy chunk, and a fictional order. It **does not generate embeddings**. AI policy retrieval may therefore require an additional indexing step before it works as intended.

**Never run these SQL scripts against the original development database or an existing production database.**

### 5. Check configuration

```bash
npm run check:config
```

This checks configuration only; it does not prove all integrations are working.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Optional production build

```bash
npm run build
npm run start
```

A successful build verifies compilation and build-time checks, not the security or correctness of all application workflows.

## Demo Data

The repository includes `supabase/seed.sql` with fictional records intended for a new test database:

| Item | Example |
| --- | --- |
| Shop | LYVOIRA Demo Shop |
| Shop UUID | `11111111-1111-4111-8111-111111111111` |
| Demo order | `DEMO-1001` |
| Demo customer email | `demo@example.com` |
| Policies | Fictional claims guidance |

The seed is a **starter dataset**, not a complete working demo environment. It does not include real customer records, precomputed policy embeddings, or a guarantee that every feature works immediately after import.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_KEY` | Public Supabase client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-only database access |
| `OPENAI_API_KEY` | OpenAI integration |
| `ADMIN_PASSWORD` | Admin login password |
| `NEXT_PUBLIC_SHOP_ID` | Shop UUID used by the application |
| `NEXT_PUBLIC_SHOP_SUPPORT_EMAIL` | Shop support email |
| `NEXT_PUBLIC_LYVOIRA_PLAN` | Demo plan setting |
| `SIGNED_URL_EXPIRE` | Signed file URL expiry in seconds |
| `MAIL_USER` | Email-related configuration |
| `RESEND_API_KEY` | Resend integration |

See `.env.example` for the complete template. Not every optional integration has been tested.

## API Organization

| Area | Example endpoint |
| --- | --- |
| AI chat | `/api/chat` |
| Messages | `/api/messages` |
| Claims | `/api/claim` |
| Admin claims | `/api/admin-claims` |
| Order verification | `/api/orders/verify` |
| Product search | `/api/products/search` |
| Policy management | `/api/policies/*` |
| Image troubleshooting | `/api/troubleshoot` |
| Uploads | `/api/upload` |
| Statistics | `/api/stats` |
| Admin login | `/api/admin-login` |

These are internal application routes, not a stable public API. Their authorization and validation requirements are still being reviewed.

## Security Considerations

LYVOIRA is a **portfolio prototype**, not a production-hardened SaaS application. Areas requiring additional work include:

- Consistent authentication and server-side authorization
- Secure customer identity verification
- Supabase RLS and Storage policies
- Protection of privileged API endpoints
- Input and upload validation
- Rate limiting and AI usage protection
- Safe error handling and secure file access

Privileged Supabase credentials must remain server-side. Do not expose the current prototype publicly with real customer data. See `SECURITY.md` for additional notes.

## Testing Status

Local functionality has been tested selectively against the original development configuration. Fresh database setup, complete customer/admin end-to-end tests, external widget installation, and production security review remain outstanding.

Known limitations include:

- Claim status updates are not working.
- Policy saving has not been verified.
- The demo seed does not contain embeddings.
- Fresh-install database permissions may need additional configuration.
- Email delivery and external widget integration are unverified.
- No comprehensive automated test suite has been established.

See `docs/TESTING.md` for further testing notes.

## Roadmap

- Validate a clean installation on a new Supabase project.
- Complete and test the claims lifecycle.
- Test policy saving and end-to-end AI policy retrieval.
- Harden authentication, authorization, RLS, and file access.
- Add automated integration tests and CI checks.
- Improve the reproducible demo dataset and onboarding instructions.
- Verify external widget installation and email delivery.
- Add screenshots and a short product walkthrough.

## Author

Developed by [laurik-code](https://github.com/laurik-code) as a full-stack AI application portfolio project.

## License

No open-source license has been selected. All rights reserved unless otherwise stated.
