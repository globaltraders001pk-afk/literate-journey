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
-- GST-EXCLUSIVE pricing (client decision 2026-11-22): catalog
-- prices are ex-GST. Checkout stores subtotal (ex-GST),
-- gst_amount = round2(subtotal x org gst_rate), grand_total =
-- subtotal + gst_amount, and total_amount = grand_total (the
-- amount actually charged). gst_amount / grand_total stay NULL
-- on old sales — no backfill, they were charged ex-GST.
-- ============================================================
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid references branches (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  invoice_number text not null,
  subtotal numeric not null default 0,
  gst_amount numeric,
  total_amount numeric not null default 0,
  grand_total numeric,
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
  add column if not exists gst_amount numeric,
  add column if not exists grand_total numeric,
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

-- ============================================================
-- SECTION AB: atomic money transactions (Phase 2, QA audit C3/H5/H9/M10/M8)
-- Same statements as supabase/migrations/20261122_money_transactions.sql
-- (2026-11-22). See that file for the full explanation.
-- ============================================================
-- ============================================================
-- Migration: atomic money transactions (Phase 2, QA audit C3/H5/H9/M10/M8)
-- Date: 2026-11-22
--
-- Before this migration every multi-step money write was a set
-- of separate PostgREST calls from the app: checkout trusted
-- client-supplied prices, inserted the sale header first and
-- only console.error'd failures of the line items / stock /
-- customer-total legs while still returning success; returns
-- never validated against the original sale; total_spent was a
-- read-add-write-back race; invoice serials were read-max-then-
-- insert with no retry; stock was summed in JS from full
-- movement history.
--
-- After it, the four functions below are the ONLY writers for
-- those flows. Each runs as ONE Postgres transaction: any leg
-- failing raises, the whole transaction rolls back, and the
-- caller's .rpc() gets an error instead of a success.
--
-- ORG DERIVATION: every function derives the caller's org from
-- their own JWT via public.my_organization_id() (defined in
-- 20261122_enable_rls.sql) — never from a parameter. A caller
-- cannot check out, return, or mint a serial for another org,
-- even though the functions are SECURITY DEFINER (needed so
-- they work the same with RLS on: they bypass RLS, but every
-- row they touch is filtered to the caller's org inside).
-- All functions set search_path = public.
--
-- SERIALS: next_invoice_number() / next_return_number() lock
-- the org row (SELECT ... FOR UPDATE) and only then take
-- max(suffix)+1 from that org's own sales / returns. Two
-- concurrent checkouts for one org serialize on the row lock,
-- so they can never mint the same number. The per-org unique
-- indexes (sales_org_invoice_key, already in the setup SQL;
-- returns_org_return_key, added below) are the backstop: a
-- 23505 on insert means the app must retry the whole checkout
-- (the TS callers do not retry today — see LIVE note below).
-- mint_invoice_number() exposes the same generator to direct
-- callers (the AI executor used to mint INV-<Date.now> itself);
-- in practice the executor now calls process_checkout, which
-- mints inside the transaction.
--
-- MONEY: prices are ALWAYS re-read from products.selling_price
-- inside the function. Client-supplied unit_price / subtotal /
-- total are never accepted (process_checkout takes no money
-- fields at all — only product ids and quantities).
--
-- IDEMPOTENT: CREATE OR REPLACE for every function, CREATE
-- UNIQUE INDEX IF NOT EXISTS, GRANTs are re-runnable. Run it
-- in the Supabase SQL Editor, or run supabase/pos-full-setup.sql
-- on a fresh project (Section AB contains the same statements).
--
-- LIVE VERIFICATION STILL OWED: no live DB is connected to
-- this repo. After running this on the live project, check:
-- (1) a POS sale deducts stock, writes items and bumps the
-- customer total, or fails as a whole; (2) a tampered checkout
-- (unit_price 0.01) still charges the catalog price;
-- (3) two simultaneous checkouts get different serials;
-- (4) a return above the sold / refundable amount is refused;
-- (5) get_stock_levels matches the old JS sum for a product.
-- ============================================================

-- ============================================================
-- 1. Per-org unique index on return numbers (backstop for the
--    sequential RET- serials, mirroring sales_org_invoice_key)
-- ============================================================
create unique index if not exists returns_org_return_key
  on public.returns (organization_id, return_number);

-- ============================================================
-- 2. Serial generators (org-row lock + max+1, inside the
--    caller's transaction). No grant: only the SECURITY DEFINER
--    functions below call them.
-- ============================================================

-- Next invoice serial for this org: <PREFIX>/<NNNN>, prefix from
-- the org's FBR settings (default GT-226). The sequence NEVER
-- restarts when the prefix changes — a new prefix starts at
-- 0001 for that prefix, old numbers stay valid.
create or replace function public.next_invoice_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  -- Lock the org row: concurrent checkouts for this org wait
  -- here, then re-read max() after the first one commits.
  select coalesce(nullif(trim(invoice_prefix), ''), 'GT-226')
    into v_prefix
    from public.organizations
    where id = p_org_id
    for update;

  if v_prefix is null then
    raise exception 'Organization not found';
  end if;

  select coalesce(max((regexp_match(invoice_number, '/([0-9]+)$'))[1]::integer), 0) + 1
    into v_next
    from public.sales
    where organization_id = p_org_id
      and invoice_number like v_prefix || '/%';

  return v_prefix || '/' || lpad(v_next::text, 4, '0');
end;
$$;

-- Next return serial for this org: RET-<NNNN>, sequential per
-- org like the invoice serials (the old RET-<Date.now> could
-- collide and carried no order).
create or replace function public.next_return_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  -- Same row lock as next_invoice_number: one org's returns
  -- serialize, so two simultaneous returns never share a number.
  perform 1 from public.organizations where id = p_org_id for update;

  select coalesce(max((regexp_match(return_number, '^RET-([0-9]+)$'))[1]::integer), 0) + 1
    into v_next
    from public.returns
    where organization_id = p_org_id
      and return_number like 'RET-%';

  return 'RET-' || lpad(v_next::text, 6, '0');
end;
$$;

-- Standalone mint for direct callers: same generator, same
-- org-row lock. The number is only reserved once the caller's
-- insert commits — a caller that mints and then fails to insert
-- leaves a gap, never a duplicate (the unique index is the
-- backstop; retry the insert, up to ~5 times, on 23505).
create or replace function public.mint_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  v_org_id := public.my_organization_id();
  if v_org_id is null then
    raise exception 'Unauthorized: no organization linked to this account';
  end if;
  return public.next_invoice_number(v_org_id);
end;
$$;

-- ============================================================
-- 3. process_checkout: one transaction for a whole POS sale.
--    p_items is a JSON array of { product_id, quantity }.
--    No money comes from the client: every unit price is
--    re-read from products.selling_price, stock is checked,
--    and the customer total is bumped atomically.
--    GST-EXCLUSIVE pricing (client decision 2026-11-22):
--    catalog prices are ex-GST; GST is charged on top at the
--    org's rate (organizations.gst_rate, default 18):
--      subtotal    = SUM(qty x selling_price)
--      gst_amount  = round2(subtotal x gst_rate)
--      grand_total = subtotal + gst_amount
--      total_amount = grand_total (the amount actually charged)
--    Both gst_amount and grand_total are stored on the sales
--    row (20261122_sale_gst_columns.sql). Old sales keep them
--    NULL — no backfill.
--    Returns { invoice_number, subtotal, gst_amount,
--    total_amount } as JSON. Any raise rolls the whole sale back.
-- ============================================================
create or replace function public.process_checkout(
  p_customer_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_branch_id uuid;
  v_customer_total numeric;
  v_payment text;
  v_invoice_number text;
  v_sale_id uuid;
  v_subtotal numeric := 0;
  v_gst_rate numeric;
  v_gst_amount numeric;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_price numeric;
  v_line_subtotal numeric;
  v_stock numeric;
  v_product_name text;
  v_seen uuid[] := '{}';
  i integer;
begin
  v_org_id := public.my_organization_id();
  v_user_id := auth.uid();
  if v_org_id is null or v_user_id is null then
    raise exception 'Unauthorized: no organization linked to this account';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Cart has too many lines (max 100)';
  end if;

  -- Customer, if given, must belong to the caller's org.
  if p_customer_id is not null then
    select total_spent into v_customer_total
      from public.customers
      where id = p_customer_id and organization_id = v_org_id;
    if not found then
      raise exception 'Customer not found in your organization';
    end if;
  end if;

  -- GST rate for this org (default 18). The org row is locked
  -- here for the whole transaction, which also serializes the
  -- serial mint below (next_invoice_number locks the same row).
  select coalesce(gst_rate, 18) into v_gst_rate
    from public.organizations where id = v_org_id for update;
  if not found then
    raise exception 'Organization not found';
  end if;

  -- Payment method normalized to the app's enum, same mapping
  -- the old JS used (UPI counts as ONLINE; unknown -> CASH).
  v_payment := upper(coalesce(nullif(trim(p_payment_method), ''), 'CASH'));
  if v_payment = 'UPI' or v_payment = 'ONLINE' then
    v_payment := 'ONLINE';
  elsif v_payment not in ('CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT') then
    v_payment := 'CASH';
  end if;

  -- Branch: first of the org, or auto-create "Main Branch".
  select id into v_branch_id
    from public.branches
    where organization_id = v_org_id
    order by created_at asc
    limit 1;
  if v_branch_id is null then
    insert into public.branches (organization_id, name)
      values (v_org_id, 'Main Branch')
      returning id into v_branch_id;
  end if;

  -- Price + stock check for EVERY line before writing anything.
  -- A failure here raises before the sale header exists.
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_item := p_items -> i;
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
    exception when others then
      raise exception 'Invalid product id in cart';
    end;
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty <> trunc(v_qty) or v_qty > 10000 then
      raise exception 'Invalid quantity in cart (must be a whole number from 1 to 10000)';
    end if;
    if v_product_id = any (v_seen) then
      raise exception 'Duplicate product in cart';
    end if;
    v_seen := v_seen || v_product_id;

    select p.selling_price, p.name
      into v_price, v_product_name
      from public.products p
      where p.id = v_product_id
        and p.organization_id = v_org_id
        and p.is_active
      for update;
    if not found then
      raise exception 'Product not found in your organization or inactive';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Product % has no valid selling price', v_product_name;
    end if;

    -- Current stock is the signed sum of this org's movements.
    select coalesce(sum(quantity), 0) into v_stock
      from public.inventory_movements
      where product_id = v_product_id
        and organization_id = v_org_id;
    if v_stock < v_qty then
      raise exception 'Insufficient stock for % (have %, need %)',
        v_product_name, v_stock, v_qty;
    end if;

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  end loop;
  v_subtotal := round(v_subtotal, 2);

  -- GST-EXCLUSIVE pricing (client decision 2026-11-22): the
  -- catalog price is ex-GST, so GST is charged on top. The
  -- customer pays subtotal + GST, and total_amount — the amount
  -- actually charged, and the figure every downstream use
  -- (reports, cashflow, total_spent, refund caps) reads — is
  -- the grand total.
  v_gst_amount := round(v_subtotal * v_gst_rate / 100, 2);
  v_total := round(v_subtotal + v_gst_amount, 2);

  -- Serial minted last, under the org-row lock, in this txn.
  v_invoice_number := public.next_invoice_number(v_org_id);

  insert into public.sales
    (organization_id, branch_id, customer_id, invoice_number,
     subtotal, gst_amount, total_amount, grand_total, payment_method, created_by)
    values
    (v_org_id, v_branch_id, p_customer_id, v_invoice_number,
     v_subtotal, v_gst_amount, v_total, v_total, v_payment, v_user_id)
    returning id into v_sale_id;

  -- Line items + stock movements, priced from the catalog.
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_item := p_items -> i;
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;
    select selling_price into v_price
      from public.products where id = v_product_id;
    v_line_subtotal := round(v_qty * v_price, 2);

    insert into public.sale_items
      (sale_id, product_id, quantity, unit_price, subtotal)
      values (v_sale_id, v_product_id, v_qty, v_price, v_line_subtotal);

    insert into public.inventory_movements
      (organization_id, branch_id, product_id, movement_type,
       quantity, reference_type, reference_id, notes, created_by)
      values
      (v_org_id, v_branch_id, v_product_id, 'STOCK_OUT',
       -v_qty, 'sale', v_sale_id,
       'Sale ' || v_invoice_number, v_user_id);
  end loop;

  -- Atomic customer-total bump (no read-add-write-back race).
  -- total_spent grows by the GRAND total — what the customer
  -- actually paid, GST included.
  if p_customer_id is not null then
    update public.customers
      set total_spent = coalesce(total_spent, 0) + v_total
      where id = p_customer_id and organization_id = v_org_id;
  end if;

  return jsonb_build_object(
    'invoice_number', v_invoice_number,
    'subtotal', v_subtotal,
    'gst_amount', v_gst_amount,
    'total_amount', v_total
  );
end;
$$;

-- ============================================================
-- 4. process_return: one transaction for a whole return.
--    p_items is a JSON array of
--    { product_id, quantity, return_action, refund_amount }.
--    Validated against the original sale: the sale must be in
--    the caller's org, every product must have been on it,
--    returned qty can never exceed sold minus already-returned,
--    and the refund can never exceed what is still refundable.
--    Returns { return_number, refund_amount } as JSON.
-- ============================================================
create or replace function public.process_return(
  p_sale_id uuid,
  p_customer_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_branch_id uuid;
  v_sale_total numeric;
  v_sale_subtotal numeric;
  v_sale_gst_amount numeric;
  v_gst_rate numeric := 0;
  v_sale_customer_id uuid;
  v_return_number text;
  v_return_id uuid;
  v_total_refund numeric := 0;
  v_already_refunded numeric;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_action text;
  v_refund numeric;
  v_sold_qty numeric;
  v_unit_price numeric;
  v_already_returned numeric;
  v_seen uuid[] := '{}';
  i integer;
begin
  v_org_id := public.my_organization_id();
  v_user_id := auth.uid();
  if v_org_id is null or v_user_id is null then
    raise exception 'Unauthorized: no organization linked to this account';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No items to return';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Return has too many lines (max 100)';
  end if;

  -- The original sale must exist in the caller's org. Its
  -- total_amount is the GRAND total (subtotal + GST) — the
  -- amount actually charged — so the refund cap below is
  -- against what the customer paid, GST included. subtotal /
  -- gst_amount give each line's GST share, so the per-line cap
  -- below is GST-inclusive too: a full return refunds the
  -- whole grand total, not just the ex-GST subtotal.
  select total_amount, subtotal, gst_amount, customer_id
    into v_sale_total, v_sale_subtotal, v_sale_gst_amount, v_sale_customer_id
    from public.sales
    where id = p_sale_id and organization_id = v_org_id;
  if not found then
    raise exception 'Sale not found in your organization';
  end if;

  -- Effective GST rate on this sale, from what was actually
  -- charged (not today's org rate, which may have changed
  -- since): gst_amount / subtotal, 0 when the sale had no GST.
  if coalesce(v_sale_subtotal, 0) > 0 then
    v_gst_rate := coalesce(v_sale_gst_amount, 0) / v_sale_subtotal;
  end if;

  -- A return for a named customer must match the sale's customer.
  if p_customer_id is not null and v_sale_customer_id is not null
     and p_customer_id <> v_sale_customer_id then
    raise exception 'Customer does not match the original sale';
  end if;
  if p_customer_id is not null then
    perform 1 from public.customers
      where id = p_customer_id and organization_id = v_org_id;
    if not found then
      raise exception 'Customer not found in your organization';
    end if;
  end if;

  -- Branch: first of the org, or auto-create "Main Branch".
  select id into v_branch_id
    from public.branches
    where organization_id = v_org_id
    order by created_at asc
    limit 1;
  if v_branch_id is null then
    insert into public.branches (organization_id, name)
      values (v_org_id, 'Main Branch')
      returning id into v_branch_id;
  end if;

  -- Refund already given back on this sale (all prior returns).
  select coalesce(sum(refund_amount), 0) into v_already_refunded
    from public.returns where sale_id = p_sale_id;

  -- Validate EVERY line before writing anything.
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_item := p_items -> i;
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
    exception when others then
      raise exception 'Invalid product id in return';
    end;
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty <> trunc(v_qty) or v_qty > 10000 then
      raise exception 'Invalid return quantity (must be a whole number from 1 to 10000)';
    end if;
    if v_product_id = any (v_seen) then
      raise exception 'Duplicate product in return';
    end if;
    v_seen := v_seen || v_product_id;

    v_action := lower(coalesce(nullif(trim(v_item ->> 'return_action'), ''), ''));
    if v_action not in ('restock', 'damage', 'discard') then
      raise exception 'Invalid return action (must be restock, damage or discard)';
    end if;

    v_refund := (v_item ->> 'refund_amount')::numeric;
    if v_refund is null or v_refund < 0 then
      raise exception 'Invalid refund amount (must be zero or more)';
    end if;

    -- The product must have been on this sale, at this price.
    select quantity, unit_price
      into v_sold_qty, v_unit_price
      from public.sale_items
      where sale_id = p_sale_id and product_id = v_product_id;
    if not found then
      raise exception 'Product was not on the original sale';
    end if;

    -- Already returned on this sale (all prior returns).
    select coalesce(sum(ri.quantity), 0) into v_already_returned
      from public.return_items ri
      join public.returns r on r.id = ri.return_id
      where r.sale_id = p_sale_id and ri.product_id = v_product_id;

    if v_qty > v_sold_qty - v_already_returned then
      raise exception 'Return quantity exceeds the quantity sold (sold %, already returned %)',
        v_sold_qty, v_already_returned;
    end if;

    -- A line's refund can never exceed what was paid for the
    -- quantity being returned, GST included: the customer paid
    -- unit_price plus that line's GST share, so the cap is the
    -- GST-inclusive line amount. (The old cap was ex-GST, so a
    -- full return could never refund the GST the customer paid,
    -- even though the total cap below is the GST-inclusive
    -- grand total.)
    if round(v_refund, 2) > round(v_qty * v_unit_price * (1 + v_gst_rate), 2) then
      raise exception 'Refund exceeds the amount paid for the returned quantity';
    end if;

    v_total_refund := v_total_refund + round(v_refund, 2);
  end loop;
  v_total_refund := round(v_total_refund, 2);

  -- The whole return's refund can never exceed the sale total
  -- minus what was already refunded on this sale.
  if v_total_refund > round(v_sale_total - v_already_refunded, 2) then
    raise exception 'Refund exceeds the amount still refundable on this sale';
  end if;

  v_return_number := public.next_return_number(v_org_id);

  insert into public.returns
    (organization_id, branch_id, sale_id, customer_id,
     return_number, status, refund_amount, created_by)
    values
    (v_org_id, v_branch_id, p_sale_id, p_customer_id,
     v_return_number, 'processed', v_total_refund, v_user_id)
    returning id into v_return_id;

  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_item := p_items -> i;
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;
    v_action := lower(trim(v_item ->> 'return_action'));
    v_refund := round((v_item ->> 'refund_amount')::numeric, 2);

    insert into public.return_items
      (return_id, product_id, quantity, return_action, refund_amount)
      values (v_return_id, v_product_id, v_qty, v_action, v_refund);

    if v_action = 'restock' then
      insert into public.inventory_movements
        (organization_id, branch_id, product_id, movement_type,
         quantity, reference_type, reference_id, notes, created_by)
        values
        (v_org_id, v_branch_id, v_product_id, 'RETURN',
         v_qty, 'return', v_return_id,
         'Restocked from return ' || v_return_number, v_user_id);
    else
      insert into public.inventory_movements
        (organization_id, branch_id, product_id, movement_type,
         quantity, reference_type, reference_id, notes, created_by)
        values
        (v_org_id, v_branch_id, v_product_id, 'WASTAGE',
         -v_qty, 'return', v_return_id,
         (case when v_action = 'damage' then 'Damaged' else 'Discarded' end)
           || ' from return ' || v_return_number, v_user_id);
    end if;
  end loop;

  -- Atomic customer-total decrement, floored at zero.
  if p_customer_id is not null and v_total_refund > 0 then
    update public.customers
      set total_spent = greatest(0, coalesce(total_spent, 0) - v_total_refund)
      where id = p_customer_id and organization_id = v_org_id;
  end if;

  return jsonb_build_object(
    'return_number', v_return_number,
    'refund_amount', v_total_refund
  );
end;
$$;

-- ============================================================
-- 5. get_stock_levels: per-product current stock, aggregated
--    in Postgres (one row per product) instead of fetching
--    every movement into JS and summing there. Status is a real
--    three-way band (Phase 3a, QA audit L7/M3): 'Out of Stock'
--    at or below zero, 'Low Stock' at or below the effective
--    minimum — 10 when minimum_stock_level is NULL or 0
--    (0 = unset) — otherwise 'In Stock'. Same function as
--    supabase/migrations/20261122_stock_status.sql.
-- ============================================================
create or replace function public.get_stock_levels()
returns table (
  product_id uuid,
  name text,
  sku text,
  minimum_stock_level integer,
  current_stock numeric,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.sku,
    p.minimum_stock_level,
    coalesce(sum(m.quantity), 0) as current_stock,
    case
      when coalesce(sum(m.quantity), 0) <= 0
        then 'Out of Stock'
      when coalesce(sum(m.quantity), 0) <= coalesce(nullif(p.minimum_stock_level, 0), 10)
        then 'Low Stock'
      else 'In Stock'
    end as status
  from public.products p
  left join public.inventory_movements m
    on m.product_id = p.id
   and m.organization_id = public.my_organization_id()
  where p.organization_id = public.my_organization_id()
    and p.is_active
  group by p.id, p.name, p.sku, p.minimum_stock_level
  order by p.name;
$$;

-- ============================================================
-- 6. Grants: the app calls these through the anon key + the
--    caller's JWT, so the `authenticated` role needs EXECUTE.
--    next_invoice_number / next_return_number stay ungranted:
--    only the SECURITY DEFINER functions above call them.
-- ============================================================
grant execute on function public.mint_invoice_number() to authenticated;
grant execute on function public.process_checkout(uuid, text, jsonb) to authenticated;
grant execute on function public.process_return(uuid, uuid, jsonb) to authenticated;
grant execute on function public.get_stock_levels() to authenticated;
