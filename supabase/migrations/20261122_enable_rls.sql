-- ============================================================
-- Migration: enable Row Level Security (RLS) on all 21 tables
-- ============================================================
-- Date: 2026-11-22 (QA audit C2, 2026-11-20)
--
-- Before this migration the app relied ONLY on app-level
-- organization_id filters, and the setup SQL granted full DML on
-- every table to the anon key with RLS off. Any valid JWT could
-- read/write any tenant's rows straight through PostgREST,
-- bypassing every role check in the app.
--
-- After this migration, every row is visible only to members of
-- the organization it belongs to. The app-level filters stay in
-- place as defense-in-depth; RLS is the backstop.
--
-- HOW IT WORKS
--   * The app talks to PostgREST with the anon key + the user's
--     JWT, so its Postgres role is `authenticated`. Every policy
--     below is granted to `authenticated` only; the `anon` role
--     (no session) matches no policy and sees nothing.
--   * The caller's org comes from their own profiles row:
--     `public.my_organization_id()` reads
--     `profiles.organization_id` for `auth.uid()`. It is SECURITY
--     DEFINER so it reads profiles bypassing RLS — otherwise a
--     policy on profiles that queried profiles would recurse.
--     It returns NULL when the caller has no profile, and every
--     policy then matches nothing (fail closed).
--   * Tables WITH an organization_id column get one ALL-commands
--     policy: `organization_id = my_organization_id()`.
--   * Tables WITHOUT one (sale_items, return_items,
--     purchase_order_items) are scoped through their parent
--     (sales / returns / purchase_orders) with an EXISTS check.
--   * `profiles` is special: a user must always read their own
--     row (even before they are linked to an org), and members
--     may read the other profiles of their own org (assignee
--     lists, task joins).
--   * `organizations` is special: members may SELECT and UPDATE
--     only their own org row. No INSERT/DELETE policy for
--     anon/authenticated — orgs are seeded by SQL, not by the app.
--
-- SERVICE ROLE BYPASSES RLS BY DESIGN. The service-role key
-- (SUPABASE_SERVICE_ROLE_KEY) has the BYPASSRLS attribute in
-- Supabase, so the admin client (lib/supabase/admin.ts: logo
-- upload, Auth admin user creation, getPublicBrand) is NOT
-- constrained by these policies. That is intentional — but it
-- means the service-role key must stay server-only, never in
-- the browser, exactly like the FBR token below.
--
-- FBR TOKEN: `organizations.fbr_token` is a backend-only
-- credential. Column-level SELECT on it is revoked from anon /
-- authenticated (a plain table-level REVOKE would NOT work —
-- Postgres ORs table and column privileges, so the table-level
-- SELECT grant has to go and the readable columns are granted
-- back one by one). The app's anon-key reads use
-- ORGANIZATION_PUBLIC_COLUMNS (lib/auth-utils.ts), which never
-- includes fbr_token, so nothing in the app breaks.
-- updateFbrSettings still WRITES the token through the anon
-- client: UPDATE on the column is untouched by a SELECT revoke,
-- and its RETURNING list is the public columns only.
-- service_role keeps SELECT on fbr_token for the future
-- server-only FBR submission path.
--
-- IDEMPOTENT: safe to re-run. ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY is a no-op the second time; every policy is dropped
-- first (DROP POLICY IF EXISTS), every function is CREATE OR
-- REPLACE. Run it in the Supabase SQL Editor, or run
-- supabase/pos-full-setup.sql on a fresh project (Section AA
-- contains the same statements).
--
-- LIVE VERIFICATION STILL OWED: no live DB is connected to this
-- repo, so these policies were verified by reading only. After
-- running this on the live project, check: (1) a signed-in user
-- sees only their own org's rows in every list; (2) a direct
-- PostgREST call with another org's id returns nothing;
-- (3) updateFbrSettings still saves, and the token never
-- appears in a browser response; (4) the AI executor's
-- owner-only writes still succeed.
-- ============================================================

-- The caller's organization, from their own profiles row.
-- SECURITY DEFINER so the read bypasses RLS (no recursion).
create or replace function public.my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.my_organization_id() to authenticated;

-- The service-role key bypasses RLS by design, but make its
-- table access explicit so a future grant change cannot lock
-- the admin client out of its own tables.
grant all on all tables in schema public to service_role;
alter default privileges in schema public
  grant all on tables to service_role;

-- ============================================================
-- 1. Enable RLS on all 21 tables
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.categories enable row level security;
alter table public.expense_categories enable row level security;
alter table public.products enable row level security;
alter table public.vendors enable row level security;
alter table public.customers enable row level security;
alter table public.employees enable row level security;
alter table public.product_batches enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.attendance enable row level security;
alter table public.payroll enable row level security;
alter table public.expenses enable row level security;
alter table public.tasks enable row level security;

-- ============================================================
-- 2. Organizations: members read/update only their own org row
-- ============================================================
drop policy if exists "org_members_read" on public.organizations;
create policy "org_members_read" on public.organizations
  for select to authenticated
  using (id = public.my_organization_id());

drop policy if exists "org_members_update" on public.organizations;
create policy "org_members_update" on public.organizations
  for update to authenticated
  using (id = public.my_organization_id())
  with check (id = public.my_organization_id());

-- ============================================================
-- 3. Profiles: own row always; other rows only in the same org
-- ============================================================
drop policy if exists "profiles_org_isolation" on public.profiles;
create policy "profiles_org_isolation" on public.profiles
  for all to authenticated
  using (id = auth.uid() or organization_id = public.my_organization_id())
  with check (id = auth.uid() or organization_id = public.my_organization_id());

-- ============================================================
-- 4. Tables with organization_id: one org-isolation policy each
-- ============================================================
drop policy if exists "org_isolation" on public.branches;
create policy "org_isolation" on public.branches
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.categories;
create policy "org_isolation" on public.categories
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.expense_categories;
create policy "org_isolation" on public.expense_categories
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.products;
create policy "org_isolation" on public.products
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.vendors;
create policy "org_isolation" on public.vendors
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.customers;
create policy "org_isolation" on public.customers
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.employees;
create policy "org_isolation" on public.employees
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.product_batches;
create policy "org_isolation" on public.product_batches
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.inventory_movements;
create policy "org_isolation" on public.inventory_movements
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.sales;
create policy "org_isolation" on public.sales
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.returns;
create policy "org_isolation" on public.returns
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.purchase_orders;
create policy "org_isolation" on public.purchase_orders
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.attendance;
create policy "org_isolation" on public.attendance
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.payroll;
create policy "org_isolation" on public.payroll
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.expenses;
create policy "org_isolation" on public.expenses
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

drop policy if exists "org_isolation" on public.tasks;
create policy "org_isolation" on public.tasks
  for all to authenticated
  using (organization_id = public.my_organization_id())
  with check (organization_id = public.my_organization_id());

-- ============================================================
-- 5. Child tables without organization_id: scoped via parent
-- ============================================================
drop policy if exists "org_isolation_via_sale" on public.sale_items;
create policy "org_isolation_via_sale" on public.sale_items
  for all to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and s.organization_id = public.my_organization_id()
  ))
  with check (exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and s.organization_id = public.my_organization_id()
  ));

drop policy if exists "org_isolation_via_return" on public.return_items;
create policy "org_isolation_via_return" on public.return_items
  for all to authenticated
  using (exists (
    select 1 from public.returns r
    where r.id = return_items.return_id
      and r.organization_id = public.my_organization_id()
  ))
  with check (exists (
    select 1 from public.returns r
    where r.id = return_items.return_id
      and r.organization_id = public.my_organization_id()
  ));

drop policy if exists "org_isolation_via_po" on public.purchase_order_items;
create policy "org_isolation_via_po" on public.purchase_order_items
  for all to authenticated
  using (exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_items.po_id
      and po.organization_id = public.my_organization_id()
  ))
  with check (exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_items.po_id
      and po.organization_id = public.my_organization_id()
  ));

-- ============================================================
-- 6. organizations.fbr_token: readable only by service_role
-- ============================================================
-- A column-level REVOKE alone does not hide a column when the
-- role also holds a table-level SELECT grant (Postgres ORs the
-- two), so the table-level grant goes first and the readable
-- columns are granted back one by one — exactly the
-- ORGANIZATION_PUBLIC_COLUMNS list the app reads
-- (lib/auth-utils.ts). barcode_value is dead and stays hidden.
revoke select on public.organizations from anon, authenticated;
grant select (
  id, name, phone, email, address, logo_url, ntn,
  invoice_prefix, bank_name, bank_iban, dispatch_text,
  payment_terms_days, gst_rate, created_at
) on public.organizations to anon, authenticated;
-- service_role keeps the token for the future server-only FBR
-- submission path (it bypasses RLS anyway; this is the column
-- grant, which BYPASSRLS does not cover).
grant select (fbr_token) on public.organizations to service_role;
