-- ============================================================
-- Qurbat ERP (pos-system-aiagent) — FULL database setup
-- ============================================================
-- NOTE (Nov 2026, FBR invoice v2): the business is now
-- "Global Traders" and the invoice prefix is GT-226. The seed in
-- Section W below reflects that — but it only affects FRESH runs.
-- The already-created LIVE database still has an organizations row
-- named 'Qurbat ERP' with prefix 'INV': rename it in the app at
-- Settings > Organization Information (name + FBR / Invoice
-- prefix). Re-running this file does NOT rename it (the seed is
-- ON CONFLICT DO NOTHING).
--
-- Run this file ONCE in the Supabase SQL Editor (paste > Run).
-- It creates the WHOLE database from scratch: all 21 tables the
-- app code touches, plus the FBR invoice columns on organizations.
--
-- WHY THIS FILE EXISTS: the repo contains NO schema, NO migrations
-- and NO .sql files — the schema lived only in the (unseen) live
-- database. The FBR-only file (fbr-radars-setup.sql) failed with
-- ERROR 42P01 "relation organizations does not exist", which means
-- the database you are connected to has NO app tables at all
-- (fresh/empty project, or the wrong project). Run THIS file instead
-- of the FBR-only one on an empty database. If your database already
-- has tables, this file is still safe — see idempotency below.
--
-- IDEMPOTENT: safe to re-run. Every CREATE TABLE / INDEX uses
-- IF NOT EXISTS, and Section Z backfills any missing column with
-- ADD COLUMN IF NOT EXISTS. If a run fails partway (e.g. a timeout),
-- just run the whole file again.
--
-- HOW THE SCHEMA WAS BUILT: every column below was inferred from
-- the app code (app/actions/*.ts, lib/ai/executor.ts, lib/auth-utils.ts):
-- what the code selects, inserts, updates, filters on, upserts on,
-- and joins with. Column types follow usage (parseFloat -> numeric,
-- YYYY-MM-DD strings -> date, Auth UUIDs -> uuid). No column was
-- invented that the code does not touch.
--
-- RLS: Row Level Security IS enabled on all 21 tables (Section AA
-- below, same statements as supabase/migrations/20261122_enable_rls.sql
-- in the repo). Every row is visible only to members of its own
-- organization; the service-role key bypasses RLS by design (it is
-- server-only, never in the browser). The GRANTs in Section Y stay —
-- PostgREST still needs them — but a grant alone no longer opens
-- another tenant's rows: the policies gate every query. The FBR
-- token column (organizations.fbr_token) is additionally hidden
-- from anon/authenticated SELECTs; only service_role can read it.
--
-- MANUAL STEP — Storage bucket (SQL cannot create buckets):
--   Supabase Dashboard > Storage > Create bucket:
--   name "organization-assets", Public bucket = ON.
--   The app uploads org logos there (organization.ts). Without it,
--   logo upload fails; everything else works.
--
-- AFTER THIS FILE:
--   1. Create the first login in Dashboard > Authentication > Users
--      (Add user, e.g. the owner email). Auth users CANNOT be made
--      by SQL. Then link it to the seeded org with the SQL in
--      Section W (replace the UUID with the real Auth user id).
--   2. Set the FBR fields in the app: Settings > FBR / Invoice
--      (NTN, FBR token, prefix). Until then invoices use
--      prefix GT-226 and no token.
--
-- LEAST-CERTAIN GUESSES (check live if behaviour looks wrong):
--   1. expenses.status DEFAULT 'pending' — the code never sets it
--      on create (expenses.ts), but the AI executor writes
--      'approved' and the ledger page renders exp.status. 'pending'
--      is the sensible default for a new, unapproved expense.
--   2. Quantities are NUMERIC, not integer — the POS sells cheese
--      by weight, so a sale of 0.5 kg must not fail an insert. All
--      code paths use parseInt or whole numbers today, which still
--      work fine in a numeric column.
--   3. products.weight is TEXT — the form placeholder is
--      "500g, 1kg wheel", i.e. free text with a unit, not a number.
--   4. vendors.items_supplied and vendors.rates are TEXT — the code
--      passes them through as raw strings (no parse, no JSON).
--   5. attendance.check_in_time / check_out_time are TEXT — passed
--      raw ("HH:MM" strings); a time column would reject other
--      formats, text never breaks.
--   6. sale_items.id is UUID like every other table. dashboard.ts
--      orders sale_items by id desc to get "latest" rows, which is
--      meaningless for UUIDs — that ordering is sloppy code, not
--      evidence of a serial id.
--   7. No unique constraint on categories (organization_id, name)
--      or expense_categories (organization_id, name): the AI chat
--      does lookup-or-create by name and assumes one row, but the
--      code proves no constraint, so none is created.
--   8. sales invoice numbers are unique PER ORG, not globally:
--      the unique index is (organization_id, invoice_number),
--      because the sequential generator is per-org and two orgs
--      will both start at GT-226/0001.
-- ============================================================

-- ============================================================
-- SECTION A: organizations (tenant root) + FBR columns
-- ============================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  -- FBR invoice fields (Settings > FBR / Invoice, pre-filled once):
  ntn text,
  fbr_token text,
  barcode_value text,
  invoice_prefix text not null default 'GT-226',
  -- FBR invoice v2 (sample-accurate rebuild, Nov 2026): bank details
  -- + dispatch line printed on the invoice, payment terms in days,
  -- and the GST rate. barcode_value is dead (sample forbids the
  -- barcode on the invoice) but kept here so re-runs stay identical.
  bank_name text,
  bank_iban text,
  dispatch_text text,
  payment_terms_days integer not null default 10,
  gst_rate numeric not null default 18,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION B: profiles (one row per Supabase Auth user)
-- id IS the Auth user id. Role drives every checkAccess gate.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references organizations (id) on delete set null,
  full_name text,
  email text,
  role text not null default 'employee',
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION C: branches (app auto-creates "Main Branch" per org)
-- ============================================================
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION D: categories + expense_categories
-- ============================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION E: products
-- weight is TEXT ("500g, 1kg wheel"). Stock is NOT stored here:
-- it is computed as sum(inventory_movements.quantity). is_active
-- defaults true — getStockLevels filters is_active = true, so a
-- missing/false default would hide every new product.
-- ============================================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  name text not null,
  sku text,
  selling_price numeric not null default 0,
  cost_price numeric not null default 0,
  unit text not null default 'pcs',
  weight text,
  minimum_stock_level integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION F: vendors + customers
-- vendors.rates / items_supplied are TEXT (raw strings in code).
-- vendors.is_active defaults true — radars treat null as active.
-- customers.total_spent defaults 0 — never set on insert.
-- ============================================================
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  items_supplied text,
  rates text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  -- FBR invoice v2: buyer NTN + buyer type, printed in "Bill To".
  ntn text,
  buyer_type text,
  total_spent numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION G: employees
-- employees.role is the free-form JOB TITLE (e.g. "Manager"),
-- distinct from profiles.role (owner|admin|manager|employee).
-- profile_id is null when the employee has no login. is_active
-- defaults true — payroll generation only picks is_active staff,
-- and toggling it bans/unbans the Auth user.
-- ============================================================
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  profile_id uuid references profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  role text not null,
  employment_type text,
  base_salary numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION H: product_batches + inventory_movements
-- movement_type is TEXT (code normalises to STOCK_IN / STOCK_OUT /
-- WASTAGE / RETURN / ADJUSTMENT in JS). reference_id is polymorphic
-- (holds a sale, return or PO id depending on reference_type),
-- so it has NO foreign key. quantity is signed: negative = out.
-- ============================================================
create table if not exists product_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  product_id uuid not null references products (id) on delete restrict,
  batch_number text not null,
  manufacturing_date date,
  expiry_date date,
  quantity_received numeric not null default 0,
  quantity_remaining numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  product_id uuid not null references products (id) on delete restrict,
  movement_type text not null,
  quantity numeric not null default 0,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION I: sales + sale_items
-- invoice_number is unique PER ORG (see header note 8).
-- subtotal and total_amount are both set to the same value by
-- checkout today (no discount/tax columns exist in the code).
-- ============================================================
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  invoice_number text not null,
  subtotal numeric not null default 0,
  total_amount numeric not null default 0,
  payment_method text not null default 'CASH',
  created_by uuid references profiles (id) on delete set null,
  -- FBR invoice v2: procurement ref printed on the invoice, plus
  -- the FBR submission response (QR shown only after a successful
  -- FBR response). fbr_status defaults to 'Pending'.
  procurement_ref text,
  fbr_status text not null default 'Pending',
  fbr_reference_no text,
  fbr_response_code text,
  fbr_response_message text,
  fbr_submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  subtotal numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION J: returns + return_items
-- return_action is 'restock' (movement RETURN, stock back) or
-- 'damage' / 'discard' (movement WASTAGE, stock out).
-- ============================================================
create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  sale_id uuid references sales (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  return_number text not null,
  status text not null default 'processed',
  refund_amount numeric not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity numeric not null default 0,
  return_action text,
  refund_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION K: purchase_orders + purchase_order_items
-- received_quantity defaults 0 — it is never set on insert,
-- only updated when a PO is received.
-- ============================================================
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  vendor_id uuid not null references vendors (id) on delete restrict,
  po_number text not null,
  status text not null default 'sent',
  total_amount numeric not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  received_quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION L: attendance + payroll
-- attendance: one row per employee per day (unique key below).
-- status is free text in the actions code ('present'/'absent'
-- in the AI bulk path); the UI defines the vocabulary.
-- payroll: one row per employee per month (unique key below —
-- the AI executor upserts on it, so it MUST exist).
-- ============================================================
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  date date not null,
  status text not null,
  check_in_time text,
  check_out_time text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  month integer not null,
  year integer not null,
  basic_salary numeric not null default 0,
  deductions numeric not null default 0,
  bonuses numeric not null default 0,
  net_salary numeric not null default 0,
  status text not null default 'draft',
  payment_date date,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION M: expenses
-- status defaults 'pending' (least-certain guess — see header).
-- The AI executor inserts 'approved'; the app create action
-- never sets it, so the default is what app-created rows show.
-- ============================================================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  category_id uuid references expense_categories (id) on delete set null,
  amount numeric not null,
  expense_date date not null,
  reference_number text,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================================
-- SECTION N: tasks
-- The two FK constraint NAMES matter: the code embeds
-- profiles!tasks_assigned_to_fkey and profiles!tasks_created_by_fkey,
-- so these exact names must exist or those queries break.
-- status values in code: 'pending' (insert), 'DONE' (dashboard
-- filter), anything else via update. priority defaults 'medium'.
-- NOTE (fix 2026-11-17): assigned_to / created_by must NOT carry an
-- inline REFERENCES here — Postgres auto-names an inline FK
-- tasks_<column>_fkey, which collides with the explicit CONSTRAINT
-- names below (ERROR 42710, run stops here). The named constraints
-- below are the only FKs on these two columns.
-- ============================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid,
  priority text not null default 'medium',
  status text not null default 'pending',
  due_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint tasks_assigned_to_fkey foreign key (assigned_to) references profiles (id) on delete set null,
  constraint tasks_created_by_fkey foreign key (created_by) references profiles (id) on delete set null
);

-- ============================================================
-- SECTION W: seed organisation (optional but recommended)
-- The app reads the FIRST organizations row as the brand on the
-- login page, and every profile must point at an organization.
-- This inserts one org with a FIXED id so you can link the first
-- user to it (see below). Safe to re-run; does nothing if the
-- row already exists. Delete or rename it in the app later.
-- ============================================================
insert into organizations (id, name, invoice_prefix)
values ('00000000-0000-0000-0000-000000000001', 'Global Traders', 'GT-226')
on conflict (id) do nothing;

-- FIRST LOGIN (do this after creating the Auth user):
--   1. Dashboard > Authentication > Users > Add user (owner email).
--   2. Copy the new user's UUID, then run:
--      insert into profiles (id, organization_id, full_name, email, role)
--      values ('<PASTE-AUTH-USER-UUID-HERE>',
--              '00000000-0000-0000-0000-000000000001',
--              'Owner', '<OWNER-EMAIL-HERE>', 'owner');
--   3. Log in with that email/password. The app auto-creates the
--      "Main Branch" row on first use.

-- ============================================================
-- SECTION Y: grants (RLS is ON — see header + Section AA)
-- The app talks to PostgREST with the anon key, so the anon and
-- authenticated roles need these grants. Grants alone do NOT open
-- other tenants' rows any more: Section AA enables RLS and adds
-- org-isolation policies that gate every query.
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;

-- ============================================================
-- SECTION Z: backfill + indexes (makes re-runs safe)
-- If a table already existed without some column (e.g. a partial
-- earlier run, or the FBR-only file was run first), these ADDs fill
-- the gaps instead of erroring. Indexes are IF NOT EXISTS too.
-- ============================================================
alter table organizations
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists logo_url text,
  add column if not exists ntn text,
  add column if not exists fbr_token text,
  add column if not exists barcode_value text,
  add column if not exists invoice_prefix text default 'GT-226',
  add column if not exists bank_name text,
  add column if not exists bank_iban text,
  add column if not exists dispatch_text text,
  add column if not exists payment_terms_days integer default 10,
  add column if not exists gst_rate numeric default 18,
  add column if not exists created_at timestamptz default now();
alter table profiles
  add column if not exists id uuid primary key references auth.users (id) on delete cascade,
  add column if not exists organization_id uuid references organizations (id) on delete set null,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists role text default 'employee',
  add column if not exists created_at timestamptz default now();
alter table branches
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists name text,
  add column if not exists created_at timestamptz default now();
alter table categories
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists created_at timestamptz default now();
alter table expense_categories
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists created_at timestamptz default now();
alter table products
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists category_id uuid references categories (id) on delete set null,
  add column if not exists name text,
  add column if not exists sku text,
  add column if not exists selling_price numeric default 0,
  add column if not exists cost_price numeric default 0,
  add column if not exists unit text default 'pcs',
  add column if not exists weight text,
  add column if not exists minimum_stock_level integer default 0,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();
alter table vendors
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists name text,
  add column if not exists contact_person text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists items_supplied text,
  add column if not exists rates text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();
alter table customers
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists ntn text,
  add column if not exists buyer_type text,
  add column if not exists total_spent numeric default 0,
  add column if not exists created_at timestamptz default now();
alter table employees
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists profile_id uuid references profiles (id) on delete set null,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists role text,
  add column if not exists employment_type text,
  add column if not exists base_salary numeric default 0,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();
alter table product_batches
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists product_id uuid references products (id) on delete restrict,
  add column if not exists batch_number text,
  add column if not exists manufacturing_date date,
  add column if not exists expiry_date date,
  add column if not exists quantity_received numeric default 0,
  add column if not exists quantity_remaining numeric default 0,
  add column if not exists created_at timestamptz default now();
-- Batches created without a stated expiry store NULL (the app
-- stopped inventing today+30d). A DB built from the older file
-- has expiry_date NOT NULL — drop it so fresh and old DBs match.
alter table product_batches alter column expiry_date drop not null;
alter table inventory_movements
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists product_id uuid references products (id) on delete restrict,
  add column if not exists movement_type text,
  add column if not exists quantity numeric default 0,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid,
  add column if not exists notes text,
  add column if not exists created_by uuid references profiles (id) on delete set null,
  add column if not exists created_at timestamptz default now();
alter table sales
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists customer_id uuid references customers (id) on delete set null,
  add column if not exists invoice_number text,
  add column if not exists subtotal numeric default 0,
  add column if not exists total_amount numeric default 0,
  add column if not exists payment_method text default 'CASH',
  add column if not exists created_by uuid references profiles (id) on delete set null,
  add column if not exists procurement_ref text,
  add column if not exists fbr_status text default 'Pending',
  add column if not exists fbr_reference_no text,
  add column if not exists fbr_response_code text,
  add column if not exists fbr_response_message text,
  add column if not exists fbr_submitted_at timestamptz,
  add column if not exists created_at timestamptz default now();
alter table sale_items
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists sale_id uuid references sales (id) on delete cascade,
  add column if not exists product_id uuid references products (id) on delete restrict,
  add column if not exists quantity numeric default 0,
  add column if not exists unit_price numeric default 0,
  add column if not exists subtotal numeric default 0,
  add column if not exists created_at timestamptz default now();
alter table returns
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists sale_id uuid references sales (id) on delete set null,
  add column if not exists customer_id uuid references customers (id) on delete set null,
  add column if not exists return_number text,
  add column if not exists status text default 'processed',
  add column if not exists refund_amount numeric default 0,
  add column if not exists created_by uuid references profiles (id) on delete set null,
  add column if not exists created_at timestamptz default now();
alter table return_items
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists return_id uuid references returns (id) on delete cascade,
  add column if not exists product_id uuid references products (id) on delete restrict,
  add column if not exists quantity numeric default 0,
  add column if not exists return_action text,
  add column if not exists refund_amount numeric default 0,
  add column if not exists created_at timestamptz default now();
alter table purchase_orders
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists vendor_id uuid references vendors (id) on delete restrict,
  add column if not exists po_number text,
  add column if not exists status text default 'sent',
  add column if not exists total_amount numeric default 0,
  add column if not exists created_by uuid references profiles (id) on delete set null,
  add column if not exists created_at timestamptz default now();
alter table purchase_order_items
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists po_id uuid references purchase_orders (id) on delete cascade,
  add column if not exists product_id uuid references products (id) on delete restrict,
  add column if not exists quantity numeric default 0,
  add column if not exists unit_price numeric default 0,
  add column if not exists received_quantity numeric default 0,
  add column if not exists created_at timestamptz default now();
alter table attendance
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists employee_id uuid references employees (id) on delete cascade,
  add column if not exists date date,
  add column if not exists status text,
  add column if not exists check_in_time text,
  add column if not exists check_out_time text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();
alter table payroll
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists employee_id uuid references employees (id) on delete cascade,
  add column if not exists month integer,
  add column if not exists year integer,
  add column if not exists basic_salary numeric default 0,
  add column if not exists deductions numeric default 0,
  add column if not exists bonuses numeric default 0,
  add column if not exists net_salary numeric default 0,
  add column if not exists status text default 'draft',
  add column if not exists payment_date date,
  add column if not exists created_at timestamptz default now();
alter table expenses
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists branch_id uuid references branches (id) on delete set null,
  add column if not exists category_id uuid references expense_categories (id) on delete set null,
  add column if not exists amount numeric,
  add column if not exists expense_date date,
  add column if not exists reference_number text,
  add column if not exists notes text,
  add column if not exists created_by uuid references profiles (id) on delete set null,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();
alter table tasks
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists organization_id uuid references organizations (id) on delete cascade,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists assigned_to uuid references profiles (id) on delete set null,
  add column if not exists priority text default 'medium',
  add column if not exists status text default 'pending',
  add column if not exists due_date date,
  add column if not exists created_by uuid references profiles (id) on delete set null,
  add column if not exists created_at timestamptz default now();

-- Unique keys the code relies on (upserts / .maybeSingle lookups).
-- attendance: markAttendance upserts on (employee_id, date).
-- payroll: AI executor upserts on (organization_id, employee_id, month, year).
-- sales: sequential invoice numbers are unique PER ORG (see header note 8).
create unique index if not exists attendance_employee_date_key on attendance (employee_id, date);
create unique index if not exists payroll_employee_month_key on payroll (organization_id, employee_id, month, year);
create unique index if not exists sales_org_invoice_key on sales (organization_id, invoice_number);

-- The tasks embeds use the FK constraint NAMES
-- (profiles!tasks_assigned_to_fkey / !tasks_created_by_fkey). The
-- CREATE TABLE above defines them, but if tasks already existed
-- without them (partial earlier run), add them here.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_assigned_to_fkey') then
    alter table tasks add constraint tasks_assigned_to_fkey foreign key (assigned_to) references profiles (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_created_by_fkey') then
    alter table tasks add constraint tasks_created_by_fkey foreign key (created_by) references profiles (id) on delete set null;
  end if;
end $$;

-- Lookup indexes (org filters + common joins / orderings).
create index if not exists idx_profiles_org on profiles (organization_id);
create index if not exists idx_branches_org on branches (organization_id);
create index if not exists idx_categories_org on categories (organization_id);
create index if not exists idx_expense_categories_org on expense_categories (organization_id);
create index if not exists idx_products_org on products (organization_id);
create index if not exists idx_products_category on products (category_id);
create index if not exists idx_vendors_org on vendors (organization_id);
create index if not exists idx_customers_org on customers (organization_id);
create index if not exists idx_employees_org on employees (organization_id);
create index if not exists idx_employees_profile on employees (profile_id);
create index if not exists idx_batches_org on product_batches (organization_id);
create index if not exists idx_batches_product on product_batches (product_id);
create index if not exists idx_batches_expiry on product_batches (expiry_date);
create index if not exists idx_movements_org on inventory_movements (organization_id);
create index if not exists idx_movements_product on inventory_movements (product_id);
create index if not exists idx_movements_created on inventory_movements (created_at);
create index if not exists idx_sales_org on sales (organization_id);
create index if not exists idx_sales_customer on sales (customer_id);
create index if not exists idx_sales_created on sales (created_at);
create index if not exists idx_sale_items_sale on sale_items (sale_id);
create index if not exists idx_sale_items_product on sale_items (product_id);
create index if not exists idx_returns_org on returns (organization_id);
create index if not exists idx_return_items_return on return_items (return_id);
create index if not exists idx_po_org on purchase_orders (organization_id);
create index if not exists idx_po_vendor on purchase_orders (vendor_id);
create index if not exists idx_po_items_po on purchase_order_items (po_id);
create index if not exists idx_attendance_org on attendance (organization_id);
create index if not exists idx_payroll_org on payroll (organization_id);
create index if not exists idx_expenses_org on expenses (organization_id);
create index if not exists idx_expenses_category on expenses (category_id);
create index if not exists idx_expenses_date on expenses (expense_date);
create index if not exists idx_tasks_org on tasks (organization_id);
create index if not exists idx_tasks_assigned on tasks (assigned_to);

-- ============================================================
-- Sections A-Z done. Section AA (RLS) follows, then verify with:
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by 1;
-- Expect 21 tables. Then create the first Auth user (Section W)
-- and the "organization-assets" Storage bucket (header).
-- ============================================================

-- ============================================================
-- SECTION AA: Row Level Security (same as supabase/migrations/20261122_enable_rls.sql)
-- Enables RLS on all 21 tables and adds org-isolation policies.
-- Run AFTER Sections A-Z on a fresh project (it is part of this
-- file), or run the migration file alone on a live DB that was
-- built from an older version of this setup.
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
