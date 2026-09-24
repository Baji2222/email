# Network Switch Service Management System

A support-ticket and order management system for network switches, built
incrementally in chunks. See `/docs/architecture.md` for the technical
overview.

**Current status: Chunk 1 — Project foundation + Supabase connection +
Authentication.**

Everything below has been verified to actually build (`npm install` +
`npm run build`) in this repo. Nothing here is a mock UI — the login
screen, protected routes, and the `/api/auth/me` check on the dashboard
are real, working code. What is **not** yet implemented: Customers,
Orders, Products, Tickets, ticket history, email sending, search,
filters, and Excel export — those arrive in Chunks 2–7 per the
development plan below.

## Prerequisites

- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) project

## 1. Create your Supabase project

1. Create a new project at supabase.com.
2. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret — backend only)
3. In **Authentication → Users**, manually create the initial admin user:
   - Email: `bajivali916@gmail.com`
   - Set a password (you'll use this to log in).

No SQL setup is required yet — Chunk 1 only uses Supabase Auth, not
custom tables.

## 2. Configure environment variables

**Backend** — copy the root `.env.example` into `backend/.env` and fill in:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
PORT=4000
NODE_ENV=development
EMAIL_PROVIDER=mock
EMAIL_FROM=bajivali916@gmail.com
FRONTEND_URL=http://localhost:5173
```

**Frontend** — create `frontend/.env` with:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_BASE_URL=http://localhost:4000/api
```

Never commit either `.env` file. Never put `SUPABASE_SERVICE_ROLE_KEY`
in the frontend `.env` — it must only exist on the backend.

## 3. Install and run

In two terminals:

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev      # http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev       # http://localhost:5173
```

Visit `http://localhost:5173`, sign in with the admin account you
created in Supabase, and you should land on `/dashboard`, which will
show "Backend session verified for bajivali916@gmail.com" once it
successfully calls the protected `/api/auth/me` endpoint. That
confirms the full chain — frontend session → backend token
verification → Supabase — is working.

## 4. Building for production

```bash
cd backend && npm run build   # outputs backend/dist
cd frontend && npm run build  # outputs frontend/dist
```

Both were verified to compile cleanly in this repo before delivery.

## Project structure

```
/frontend        React + Vite + TypeScript + Tailwind
/backend         Node + Express + TypeScript
/database
  /migrations    SQL migrations (empty until Chunk 2)
  /seed          Dev-only demo data (empty until Chunk 2)
/docs            Architecture notes
```

## Development plan (chunks)

| Chunk | Scope |
|---|---|
| **1 (this delivery)** | Project setup, Supabase connection, authentication |
| 2 | DB migrations: customers, orders, products, tickets, ticket_history, email_messages |
| 3 | Customer / Order / Product UI (CRUD) |
| 4 | Ticket UI, timeline, status changes, replies, internal notes |
| 5 | Mark as Solved workflow, mock email, retry |
| 6 | Real Gmail OAuth outbound email |
| 7 | Search, filters, pagination, Excel export, dashboard metrics |
| 8 | Security hardening, RLS policies, tests, deployment docs |
| Phase 2 | Engineers/roles, realtime, attachments, audit log, reports |
| Phase 3 | Inbound Gmail automation, automatic ticket matching |

Each chunk after this one will build on the current code without
breaking what's already working.

## Security notes (already in place)

- `SUPABASE_SERVICE_ROLE_KEY` is read only in `backend/src/config/supabase.ts` and is never sent to the frontend.
- All protected API routes go through `requireAuth`, which verifies the Supabase-issued JWT server-side before allowing access.
- Errors are logged in full server-side but only a safe, generic message is ever returned to the client (see `backend/src/middleware/errorHandler.ts`).
- `.env` is git-ignored at the root and in both `frontend/` and `backend/`.

## Deployment (later chunks)

Frontend → Vercel (static Vite build). Backend → Vercel serverless
functions or any Node host (Render, Railway, Fly.io). Database →
Supabase (already hosted). Full deployment steps will be written once
Chunk 8 (production hardening) is complete — deploying earlier chunks
is possible but premature since most features don't exist yet.
