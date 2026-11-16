# FBR Invoice + Four Radars — Handover

**Repo:** `github.com/muhammad-araf/pos-system-aiagent` (package `qurbat-erp`)
**Built:** 2026-11-16 · **HEAD:** `3d2ba7e` ("Halo") · **Local only — nothing committed, nothing pushed.**
**Client:** medical / pharma business (name + email not provided yet). Finance software kept as-is; these two additions only.
**Deadline:** 2 days, by 2026-11-18.

## What was built

### Part A — Four Radars (`/radars`, sidebar entry "Radars", owner/admin/manager only)

| File | What |
|---|---|
| `app/actions/radars.ts` (new) | `getExpiryRadar()`, `getStockRadar()`, `getInventoryRadar()`, `getVendorsRadar()`, `getRadarSummary()` — all real Supabase queries, no mock data |
| `app/(dashboard)/radars/page.tsx` + `radars-client.tsx` + `loading.tsx` (new) | Four tabs (Expiry / Stock / Inventory / Vendors), count cards first, then detail tables |
| `components/app-sidebar.tsx` | "Radars" entry after Reports, `!isEmployee` gate |
| `app/(dashboard)/dashboard/page.tsx` + `dashboard-client.tsx` | Compact alert strip after the KPI grid (non-employees only), links to `/radars` |

**Thresholds (constants at the top of `radars.ts`):**
- **Expiry bands** (days left, counted from start of today): `EXPIRED` < 0 · `URGENT` 0–29 days · `WARNING_4M` 30–119 days (4 months) · `WATCH_6M` 120–180 days (6 months) · `HEALTHY` > 180 days. `expiringWithin180Days` counts expired + urgent + warning + watch. Batches with `quantity_remaining <= 0` are excluded.
- **Stock:** same computation as `getStockLevels` (sum of `inventory_movements.quantity`). `Out of stock` qty ≤ 0 · `Low` 0 < qty ≤ `minimum_stock_level` (the column exists on products) · `Healthy` otherwise. Fallback threshold 10 applies only when `minimum_stock_level` is null — note: `createProduct` stores **0** when unset, so for products with no minimum set, Low never fires (see Pending below).
- **Inventory:** last 30 days + 7-day totals grouped by movement type (STOCK_IN / STOCK_OUT / WASTAGE / RETURN / ADJUSTMENT), top movers by absolute quantity, negative-stock anomaly list.
- **Vendors:** status from `vendors.is_active`; pending PO = status neither `received` nor `cancelled`; a pending PO older than **30 days** is flagged overdue.

### Part B — FBR Invoice System

| File | What |
|---|---|
| `app/(dashboard)/settings/settings-client.tsx` + `page.tsx` | New "FBR / Invoice" card (owner/admin only): NTN, FBR token (password input), barcode value (optional — empty = barcode the invoice serial), invoice prefix (default `INV`). Name/address/phone reused from Organization Information, not duplicated. |
| `app/actions/organization.ts` | New `updateFbrSettings` action (owner/admin only, prefix sanitized to A–Z/0–9/hyphen, max 10 chars) |
| `components/providers/organization-provider.tsx` | `OrganizationData` extended with the four FBR fields |
| `app/actions/sales.ts` | `generateSequentialInvoiceNumber()` in `processCheckout`: format `PREFIX-YYYY-NNNN` (e.g. `INV-2026-0001`), next = max existing suffix + 1 for that org, sequence restarts each year. Old `INV-xxxxxx` rows still resolve via `getInvoiceByNumber`. |
| `app/(dashboard)/sales/invoices/[id]/page.tsx` + `fbr-invoice-client.tsx` + `loading.tsx` (new) | FBR invoice view: logo, company name/address/phone/email, NTN, FBR token, real Code128 barcode (jsbarcode), serial, date, buyer, line items, totals, footer note. Clean black-on-white, print-friendly. The invoice block is split into commented sections so the client's mockup can be applied in one pass. |
| `app/(dashboard)/sales/pos/pos-client.tsx` | Checkout-success dialog now has an **FBR Invoice** button linking to `/sales/invoices/<invoice number>` |
| `package.json` / `package-lock.json` | `jsbarcode@3.12.3` added (renders the barcode as SVG) |

**Print + Copy (from the invoice view):**
- **Print:** `window.print()` + `@media print` CSS that hides everything except `#fbr-invoice-print`; `@page` A4, 12mm margins.
- **Copy for FBR:** plain-text invoice (seller, NTN, FBR token, serial, date, buyer, items, totals, footer) via clipboard with textarea fallback. **Copy as formatted:** HTML + plain text via `ClipboardItem`, falling back to plain text.

**Settings storage:** the token/barcode live ONLY in the `organizations` table in the DB — nothing is hardcoded in git (deliberately, after the repo's earlier committed-key problem).

## SQL to run on the live DB — BEFORE the FBR fields work

File: `~/workspace/your_files/fbr-radars-setup.sql` (idempotent, safe to re-run)

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ntn text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fbr_token text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS barcode_value text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_prefix text;
```

Run it in the Supabase SQL Editor. Until then: saving FBR settings fails with a "column does not exist" error (shown in the form), and checkout falls back to prefix `INV`. The radars need **no** new columns — they read existing tables.

## Verification (2026-11-16, no live DB here)

- `npx tsc --noEmit`: **PASS** (exit 0)
- `npm run build`: **PASS** — `/radars` and `/sales/invoices/[id]` both in the route list
- `npm run lint`: **174 problems (139 errors, 35 warnings) — exactly the pre-build baseline, delta 0**
- Tester found 2 issues during verification; both fixed by the coordinator: (1) `radars.ts` exported constants from a `'use server'` file, which broke the Turbopack build — constants are now module-private; (2) one new `catch (err: any)` in settings — now typed properly.
- Reachability verified statically: sidebar Radars entry, dashboard strip → `/radars`, POS dialog → FBR invoice; no orphan routes. Employee role is redirected from `/radars` and sees neither the strip nor the sidebar entry.

## Still pending

1. **Client invoice mockup — NOT received yet.** The layout is a clean FBR-style default; when the reference page arrives, re-skin `fbr-invoice-client.tsx` (its sections are commented for exactly this).
2. **Real FBR token — NOT received yet.** Settings field is empty placeholder; the client supplies it, it is entered once in Settings → FBR / Invoice, then auto-applied to every invoice.
3. **Client name / logo / email** — not provided yet; logo + org details come from the existing Settings → Organization Information (logo upload already exists).
4. **Run `fbr-radars-setup.sql`** on the live Supabase DB (see above).
5. **Live checks (need DB + browser):** `/radars` tabs and counts, dashboard strip per role, POS checkout → FBR Invoice → barcode/print/copy, FBR settings save, second invoice same year confirms the sequence increments.
6. **Owner decisions (not built):** serial-number race — two simultaneous checkouts can read the same max and duplicate a serial (needs a unique index on `sales(invoice_number)` + retry, or a Postgres sequence); Low-stock rule — products with `minimum_stock_level = 0` (the default) never show Low, so per-product minimums need setting or the fallback rule revisited.
7. **Not touched (out of scope):** the audit findings in `ANALYSIS.md` (committed API key, RLS, lint baseline) — separate job.

## Full DB setup — 2026-11-16

**Why:** the user ran `fbr-radars-setup.sql` on the live database and got `ERROR 42P01: relation "organizations" does not exist` — the connected database has **no app tables at all** (fresh/empty project, or the wrong project). The repo contains no schema or migrations anywhere, so the full schema was inferred from the code and delivered as a new single file.

**File:** `~/workspace/your_files/pos-full-setup.sql` (728 lines, ~37 KB). **Use this file instead of `fbr-radars-setup.sql` on an empty database** — it includes the FBR columns (ntn, fbr_token, barcode_value, invoice_prefix on organizations) plus all 21 tables the code touches: organizations, profiles, branches, categories, expense_categories, products, vendors, customers, employees, product_batches, inventory_movements, sales, sale_items, returns, return_items, purchase_orders, purchase_order_items, attendance, payroll, expenses, tasks. The FBR-only file is still the right one for a database that already has tables.

**How it was built:** four extractors read every file in `app/actions/*.ts`, `lib/ai/executor.ts`, `lib/auth-utils.ts` and `lib/supabase/*`; every column was traced to a select/insert/update/filter/upsert/join in the code. Coverage verified by the coordinator: all 21 `.from()` tables in the code have a CREATE TABLE (zero missing, zero extra); all extracted columns are present; parentheses balance; no live DB was available, so nothing was executed.

**What is inside:** CREATE TABLE IF NOT EXISTS for all 21 tables (FKs with matching ON DELETE actions; `profiles.id` references `auth.users(id)`); a backfill section (ADD COLUMN IF NOT EXISTS for every column, so re-runs after a partial failure never error); 3 unique indexes the code relies on — attendance (employee_id, date), payroll (organization_id, employee_id, month, year), sales (organization_id, invoice_number) — plus 33 lookup indexes; GRANTs to anon/authenticated (the app uses the anon key, so without them every query fails with permission denied); an optional seed organization row with a fixed UUID plus the commented SQL to link the first Auth user to it as owner.

**No RLS (deliberate):** tables are created WITHOUT Row Level Security, matching how the app is written (anon-key client + app-level organization_id filters). Do NOT enable RLS with no policies — it would block every query. RLS hardening is a separate job.

**Manual step (SQL cannot do this):** create the Storage bucket `organization-assets` (public) in Dashboard > Storage — logo upload needs it.

**Least-certain guesses (header of the SQL lists 8):** expenses.status defaults `'pending'` (code never sets it on create; AI writes `'approved'`); quantities are NUMERIC not integer (POS sells by kg — 0.5 kg must not fail an insert); products.weight is TEXT (`"500g, 1kg wheel"`); vendors.items_supplied/rates are TEXT; attendance check_in/out_time are TEXT; sale_items.id is UUID (the `order('id', desc)` "latest" logic in dashboard.ts is sloppy code, not evidence of a serial); no unique constraint on (organization_id, name) for categories/expense_categories; sales invoice numbers unique PER ORG, not globally.

**Still open:** confirm which Supabase project is the right one (the 42P01 came from a database with zero tables — if the real project already has tables, run the FBR-only file there instead); run this file; create the first Auth user + profiles row (Section W of the file); create the bucket; then the live checks from §"Still pending" item 5.
