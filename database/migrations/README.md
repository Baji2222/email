# Database Migrations

Empty in **Chunk 1** by design.

Chunk 1 uses Supabase Auth's built-in `auth.users` table for admin login —
no custom tables are required yet.

**Chunk 2** will add the first migration files here:

- `0001_create_customers.sql`
- `0002_create_orders.sql`
- `0003_create_products.sql`
- `0004_create_tickets.sql`
- `0005_create_ticket_history.sql`
- `0006_create_email_messages.sql`
- `0007_create_admin_users.sql`
- RLS policies for each table

Migrations will be plain `.sql` files, numbered sequentially, intended to
be run via the Supabase SQL editor or the Supabase CLI
(`supabase db push`).
