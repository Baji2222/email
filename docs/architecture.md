# Architecture — Chunk 1

```
React Frontend (Vite + TS + Tailwind)
        │  Supabase Auth (sign in, session)
        │  fetch() with Bearer <access_token>
        ▼
Backend API (Express + TS)
        │  requireAuth middleware verifies token via Supabase
        ▼
Supabase (Postgres + Auth)
```

## What exists in Chunk 1

- **Frontend**: Vite/React/TS/Tailwind app with React Router and
  TanStack Query wired in. A `/login` page using Supabase Auth
  (`signInWithPassword`), an `AuthProvider` context, and a
  `ProtectedRoute` guard around every route listed in the spec
  (`/dashboard`, `/orders`, `/customers`, `/products`, `/tickets`,
  `/settings`). Sidebar/Topbar layout shells are in place. Only the
  Dashboard page does real work right now (it calls the backend to
  prove the auth chain is connected); the rest are "Coming soon" stubs
  until their chunk arrives.
- **Backend**: Express/TS API with environment validation (Zod), a
  Supabase admin client (service-role, backend-only) and a Supabase
  auth-verification client (anon key, used only to validate tokens).
  `requireAuth` middleware protects routes by verifying the Supabase
  JWT sent from the frontend. `/api/health` is public; `/api/auth/me`
  is the first protected route and is used by the dashboard to confirm
  the session is valid end-to-end.
- **Database**: no custom tables yet. Chunk 1 relies entirely on
  Supabase's built-in `auth.users` for the admin account. Custom
  tables (customers, orders, products, tickets, ticket_history,
  email_messages, admin_users) arrive in Chunk 2 with full RLS
  policies.

## Why no service role key on the frontend

The frontend only ever holds the Supabase **anon** key, which is safe
to ship to the browser because Row Level Security (added in Chunk 2)
governs what it can read/write. All privileged operations happen on
the backend using the **service role** key, which is never sent to
the client and is only ever read from `process.env` on the server.

## Email

Not implemented in Chunk 1. The `EmailService` abstraction (with a
`MockEmailProvider` default and a `GmailProvider` for Chunk 6) is
introduced starting in Chunk 5, so ticket business logic never talks
to Gmail directly.
