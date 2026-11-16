# POS System / Qurbat ERP — Senior Analysis

**Repo:** `github.com/muhammad-araf/pos-system-aiagent` · **HEAD:** `3d2ba7e` ("Halo") · **Analysed:** 2026-11-16
**Package:** `qurbat-erp` v0.1.0 · Next.js 16.3.4 (Turbopack) + React 19 + Supabase (`@supabase/ssr`, `supabase-js`) + Tailwind 4 + shadcn/base-ui · 129 TS/TSX files

## One-line verdict

A broadly real, working cheese/dairy POS + ERP — all 18 routes render real data and every form calls a real Supabase-backed action, and the build passes — **but it is not production-safe for money movement: a live-format API key is committed to git, tenant isolation cannot be verified from the repo (no schema, no RLS, no migrations), most reads and several writes carry no organization scoping or role check, and the financial core (checkout, returns, purchase receiving, payroll) is non-atomic, trusts client-supplied prices/totals, and reports success when its writes fail.**

---

## 1. What it is

A **POS + ERP for a cheese/dairy retail shop** ("Qurbat ERP", `app/layout.tsx:18`). Evidence:

- `getCheeseCommandCenterData` / `topCheeses` (`app/actions/dashboard.ts:8,152,223`)
- Product examples "Cheddar Cheese" / "Smoked Cheddar" (`app/(dashboard)/inventory/products/product-form.tsx:60`, `app/(dashboard)/chat/chat-client.tsx:486`)
- Category example "Dairy" (`app/(dashboard)/inventory/categories/category-form.tsx:51`); units "kg, wheel, box" (`product-form.tsx:102`)
- Vendor example "Alpine Dairy Cooperative … Raw Milk, Cultures, Rennet, Wax" (`app/(dashboard)/purchases/vendors/vendor-form.tsx:61,79`)
- Guidance "Keep soft and bloomy cheeses between 4°C–8°C" (`app/(dashboard)/dashboard/dashboard-client.tsx:415`); perishable batch/expiry tracking throughout
- Currency shown is **`$`** everywhere in the UI, but payment methods include **UPI** (`app/actions/sales.ts:106`) and the settings phone placeholder is **+92 (Pakistan)** (`app/(dashboard)/settings/settings-client.tsx:808`) — most likely a Pakistani cheese/dairy business displaying USD
- Multi-tenant by `organization_id` + `branches`; roles `owner | admin | manager | employee` (`lib/auth-utils.ts:5`)

There is no landing page: `/` (`app/page.tsx:1-5`) unconditionally redirects to `/dashboard`.

## 2. Module map

Status means: **WORKING** = code path fully wired to real Supabase calls (static audit only — no live DB was available, so nothing was executed); **PARTIAL** = real but with a named gap; **STUB** = placeholder/fake. No module is a pure stub.

| Route | What it actually does | Status |
|---|---|---|
| `/` | `redirect('/dashboard')` | WORKING |
| `/login` | Email/password form → `login` action (`app/actions/auth.ts:6-26`, Supabase `signInWithPassword`); brand via `getPublicBrand` | WORKING |
| `/dashboard` | `getCheeseCommandCenterData`: sales today/month, growth, 7-day trend, recent sales, top products, low-stock, expiring batches, tasks. Employee role gets a static "Shift Operations & Guidelines" card instead of trend data (`dashboard-client.tsx:397-419`) | WORKING (quirks: §5) |
| `/chat` (owner-only) | Full chat UI, SSE `fetch('/api/ai/chat')`, thinking + tool-action receipts, invoice modal via `getInvoiceByNumber`; quick-action menu sends hardcoded prompts (`chat-client.tsx:486-524`) | WORKING — except it seeds 3 fake sample conversations into localStorage (§4) |
| `/sales/pos` | Product grid + cart + customer/payment select → `processCheckout` (`app/actions/sales.ts:53-184`) writes `sales` + `sale_items` + `STOCK_OUT` movements + customer `total_spent`; printable invoice dialog (`pos-client.tsx:339-487`) | WORKING — no stock-availability check (`pos-client.tsx:51-67`); no discount/tax; batch-insert failures only `console.error` yet returns `{success:true}` (`sales.ts:167-174`) |
| `/sales/customers` | Table + create form → `createCustomer` | WORKING (create + list only; no edit/delete) |
| `/sales/returns` | Return history + form → `processReturn` (`app/actions/returns.ts:25-154`): writes `returns` + `return_items`, restock → `RETURN` movement, damage/discard → `WASTAGE`, decrements customer `total_spent` | WORKING (table shows only the first item of each return, `returns/page.tsx:51-53`) |
| `/inventory/stock` | Read-only table; stock = sum of `inventory_movements.quantity` per product (`inventory.ts:228-259`) | WORKING |
| `/inventory/movements` | Ledger table (limit 200) + create form → `createMovement` (normalises free-text types to `STOCK_IN/STOCK_OUT/WASTAGE/RETURN/ADJUSTMENT`, `inventory.ts:320-339`) | WORKING |
| `/inventory/products` | Table + create/edit → `createProduct`/`updateProduct`; delete → `deleteProduct` (soft-deactivates if the product has movements/sales, hard-deletes otherwise, `inventory.ts:187-226`); cost price hidden from non-admin/owner | WORKING |
| `/inventory/categories` | Table + create/edit → `createCategory`/`updateCategory` | PARTIAL — page shows a "Default Discount" column (`categories/page.tsx:47`, `cat.default_discount_percentage`) that no action ever reads or writes; `deleteCategory` exists (`inventory.ts:69-81`) but no UI calls it |
| `/inventory/batches` | Table with expiry badges + create form → `createBatch` (also writes a `STOCK_IN` movement, `inventory.ts:419-428`) | WORKING |
| `/purchases/orders` | Table + single-line PO form → `createSimplePO`; "Receive" → `receivePurchaseOrder` (marks PO/item received, creates batch + `STOCK_IN` movement) | PARTIAL — single-item POs only; `receivePurchaseOrder` (`purchases.ts:100-172`) has no `checkAccess` call, no status guard (re-receiving duplicates batch + movement), hardcodes expiry to +30 days "for demo" (`purchases.ts:134`); no edit/cancel/delete PO |
| `/purchases/vendors` | Table + create/edit → `createVendor`/`updateVendor`; per-vendor order-history dialog → `getVendorOrders` | WORKING (no delete; `is_active` badge shown but not editable in the form) |
| `/employees/list` | Directory + create/edit → `createEmployee`/`updateEmployee`; can create a Supabase Auth user + `profiles` row via admin client, bans/unbans login when `is_active` toggles (`employees.ts:178-190`) | WORKING (no delete) |
| `/employees/attendance` | Manager roster: per-employee status buttons → `markAttendance` (upsert on `employee_id,date`); employee role gets read-only self-service view (today's status + 30-day history) | WORKING — no date picker in the UI; date comes only from the `?date=` query param (`attendance/page.tsx:15-18`) |
| `/employees/payroll` | Register table + "Generate" → `generatePayroll` (upserts one `payroll` row per active employee) and "Pay" → `payPayroll` (status → `paid`) | PARTIAL — `generatePayroll` hardcodes `deductions: 0, bonuses: 0, net = base_salary` (`payroll.ts:33-43`, no attendance/deduction logic); no month/year picker in the UI (query params only, `payroll/page.tsx:17-21`); no edit |
| `/expenses/ledger` | Expenses table + create form → `createExpense` | PARTIAL — create + list only: no edit/delete/approve actions exist; table shows a `status` column (`ledger/page.tsx:60-65`) but `createExpense` never sets `status` (`expenses.ts:100-111`, relies on an unseen DB default) |
| `/expenses/categories` | Table + create form → `createExpenseCategory` | PARTIAL — create + list only; no update/delete actions exist |
| `/expenses/cashflow` | Read-only P&L: income (sales) − expenses − paid payroll for the month, computed inline in the page (no action file) | WORKING — no month/year picker (query params only); "Expense Breakdown" lists individual expense rows, not grouped by category (`cashflow/page.tsx:105-118`) |
| `/reports` | 4 client tabs (Sales / Inventory / Vendors / P&L) fed by `getComprehensiveReports` (`app/actions/reports.ts:6-228`); P&L hidden from non-admin/owner | WORKING (read-only) — no CSV export, download, or print button anywhere in `reports-client.tsx` (463 lines) |
| `/settings` (admin/owner) | Theme picker, org info edit → `updateOrganization`, logo upload to Storage bucket `organization-assets` → `uploadOrganizationLogo`, logo-URL set/remove | WORKING — no user/role-management or branch-management UI anywhere |
| `/tasks` | Task board + create form → `createTask`; status change + delete → `updateTaskStatus`/`deleteTask`; employees see only their own tasks (`tasks.ts:23-25`) | WORKING |

**Global wiring:** `proxy.ts` + `lib/supabase/middleware.ts` (cookie fast-path: no `sb-*-auth-token` → instant redirect to `/login`; logged-in user on auth routes → `/dashboard`); `(dashboard)/layout.tsx` loads profile + org, renders role-gated `AppSidebar` (owner-only AI Chat + localStorage recent chats) + header. Every route has a `loading.tsx` skeleton. Every form checked calls a real server action (all 19 form/button components verified). No `TODO`/`FIXME`/`XXX`/`HACK`/"coming soon"/"mock" markers anywhere in `app/`, `components/`, `lib/` (grep clean; only false positives were the `ListTodo` icon name and input `placeholder=` attributes).

## 3. Architecture

- **Stack:** Next.js 16.3.4 (Turbopack) + React 19 + Tailwind 4 + shadcn/base-ui + `next-themes` + `lucide-react`. No test runner, no tests, no validation library (no zod), no ORM, no generated Supabase types.
- **Data flow:** almost everything goes through **server actions** (`app/actions/*.ts`, 13 files) using the anon-key Supabase SSR client (`lib/supabase/server.ts`, `createClient()` wrapped in React `cache()`). There is exactly **one API route**: `POST /api/ai/chat`. There is **no `.rpc()` call anywhere** in `app/` or `lib/` — no database transactions or Postgres functions for any multi-step write.
- **Auth:** Supabase Auth email/password via the `login` server action (`app/actions/auth.ts:6-26`, fixed redirect to `/dashboard`); sessions are Supabase SSR cookies refreshed in `proxy.ts` → `lib/supabase/middleware.ts`. Roles live in `profiles.role` (`owner | admin | manager | employee`). Enforcement helper `checkAccess(roles)` (`lib/auth-utils.ts:33-45`) denies by calling `redirect()`, which throws — and most callers wrap it in `try/catch` and return `{ error }`, swallowing the redirect (see §5, B8). Some section layouts call `checkAccess` (employees, expenses, purchases, reports, settings); inventory, sales, tasks, and dashboard pages have no layout/page gate.
- **Multi-tenancy:** purely application-level `.eq('organization_id', profile.organization_id)` filters on the anon-key client, applied inconsistently (see §4). There is **no schema, migration, seed, `.sql` file, or `supabase/` directory in the repo** — a fresh database cannot be recreated from this repo; the schema exists only in the (unseen) live Supabase project. Tables referenced by actions (20, inferred from `.from('…')` calls): `profiles`, `organizations`, `branches`, `products`, `categories`, `product_batches`, `inventory_movements`, `sales`, `sale_items`, `customers`, `returns`, `return_items`, `purchase_orders`, `purchase_order_items`, `vendors`, `employees`, `attendance`, `payroll`, `expenses`, `expense_categories`, `tasks`. Plus Storage bucket `organization-assets` (`app/actions/organization.ts:136`).
- **Service-role key:** `lib/supabase/admin.ts:3-15` (`SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS) is used for public branding (`organization.ts:10`), logo upload/storage (`organization.ts:129`), and Auth Admin user create/ban in employee management (`employees.ts:78,180`).
- **AI chat:** see §6.
- **Env vars referenced in code:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`. **No `.env.example` exists** (`.env*` is gitignored).

## 4. Security findings

Severity is judged on the code as written. Anything marked "RLS-conditional" depends on Row Level Security in the live Supabase project, which **cannot be verified from this repo** (no schema/policies anywhere in the tree). If live RLS is enabled and correct, the RLS-conditional items are mitigated; if it is off or permissive, they are live.

### CRITICAL

**S1 — Live-format OpenRouter API key committed to git.** `scratch/test-openrouter.js:1` contains a full `sk-or-v1-…` key in plaintext; `git ls-files` confirms it is tracked, committed in `8f46bb8` ("COmplete the packages and add ai agent feture"). The key is format-valid (standard OpenRouter `sk-or-v1-` key). The file is a scratch test script (not imported by the app) that also contains a hardcoded fake tool-call response (`test-openrouter.js:14-22`). **Impact:** anyone with repo access can spend/abuse the owner's OpenRouter account. **Fix:** revoke/rotate the key in OpenRouter immediately, delete the file, and purge it from git history (deleting the file alone is not enough — it stays in history). The key value is deliberately not reproduced in this report.

**S2 — No RLS / schema / migrations anywhere in the repo (tenant isolation unverifiable).** Zero matches for `create policy`, `enable row level security`, or `rls` in the tree; no `supabase/` directory, no `.sql` file. **Impact:** if RLS is off or permissive in the Supabase project (nothing in the repo proves otherwise), the public anon key (`lib/supabase/client.ts:5-6`, `lib/supabase/server.ts:9-10`) lets anyone with a valid JWT call PostgREST directly and bypass every role check and org filter in the app code. The whole multi-tenancy model rests on each action remembering to filter by `organization_id` — and most don't (S4). **Fix:** add the schema + RLS policies to the repo as migrations and verify them against the live project.

### HIGH

**S3 — Middleware trusts cookie-name presence; fails open on missing env (RLS-conditional).** `lib/supabase/middleware.ts:12-24,34-36`: `hasAuthCookie` only checks a cookie **name** starts with `sb-` and contains `-auth-token`. Prefetch requests carrying such a cookie skip `getUser()` entirely (fast path 3). `app/actions/dashboard.ts:8-76` then runs with no auth check (it fetches the profile but never rejects a null one, defaulting to role `employee`) and queries `sales`, `sale_items`, `categories`, `products` with **no `organization_id` filter**. An expired/forged-name cookie + prefetch can therefore reach server-component data fetching without a validated session. Separately, `middleware.ts:40-44`: if `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, it logs an error and returns `NextResponse.next()` with no redirect — a misconfigured deploy leaves every protected route publicly reachable.

**S4 — Most read actions have no org filter (cross-tenant leak for any signed-in user, RLS-conditional).** All use the anon-key client, so with no RLS these return every tenant's rows: `inventory.ts:7-16` (`getCategories`), `:83-95` (`getProducts`), `:228-260` (`getStockLevels`), `:261-280` (`getMovements`), `:360-373` (`getBatches`), `:435-483` (`getDashboardStats`); `sales.ts:6-15` (`getCustomers`); `purchases.ts:6-22` (`getPurchaseOrders`); `returns.ts:6-23` (`getReturns`); `expenses.ts:7-16,52-66` (`getExpenseCategories`, `getExpenses`); `vendors.ts:7-16` (`getVendors`); `employees.ts:7-21` (`getEmployees`, incl. salaries), `:196-205` (`getAttendance`), `:207-218` (`getEmployeeAttendanceHistory`); `dashboard.ts:41-76` (all `sales`/`sale_items` queries); `reports.ts:32-36` (`sale_items` query, no org filter — exposes other tenants' cost prices); `payroll.ts:55-65` (`getPayroll` — any employee can read all payroll rows for a month/year). Verified independently: 18 of ~25 read actions have neither an auth check nor an `organization_id` reference.

**S5 — IDOR: updates/deletes keyed by bare `id`, never by org (RLS-conditional).** `inventory.ts:50-81` (`updateCategory`/`deleteCategory`), `:147-227` (`updateProduct`/`deleteProduct`); `vendors.ts:66-102` (`updateVendor`); `payroll.ts:67-78` (`payPayroll`); `tasks.ts:88-102,104-117` (`updateTaskStatus`/`deleteTask`); `purchases.ts:100-165` (`receivePurchaseOrder` updates PO/items by id only). Any authenticated user who knows/guesses a UUID can modify or delete another tenant's records.

**S6 — Write actions with no role check at all (any `employee` can call them).** `inventory.ts:18-49` (`createCategory`), `:50-81` (`update/deleteCategory`), `:282-359` (`createMovement` — arbitrary stock adjustments), `:374-434` (`createBatch`); `purchases.ts:24-99` (`createSimplePO`), `:100-165` (`receivePurchaseOrder` — books stock in); `returns.ts:25-160` (`processReturn` — refunds/restocks); `sales.ts:17-52` (`createCustomer`), `:53-187` (`processCheckout`); `employees.ts:196-218` (`getAttendance`/`getEmployeeAttendanceHistory`, no check). Page-level `checkAccess` gates are UI-only and do not protect server actions, which are directly callable.

**S7 — Privilege escalation to `owner` via unsanitized `system_role` (verified).** `app/actions/employees.ts:40` takes `system_role` raw from FormData and `:96-104` inserts it into `profiles.role` with **no whitelist**. `createEmployee` is gated to `['admin','owner']` (`:25`), so an **admin** can create an `owner` login. Worse, `updateEmployee` is gated to `['admin','owner','manager']` (`:135`) and `:150,172-177` writes raw `system_role` into any linked profile — a **manager** can promote themselves (or anyone) to `owner`, and then use the owner-only AI agent (§6).

**S8 — `processCheckout` trusts all client-supplied money.** `app/actions/sales.ts:53-72` accepts `cart[].unit_price/subtotal`, `totalAmount`, `product_id`, `customerId` from the caller and never re-validates prices against the catalog, never verifies the product/customer belongs to the caller's org, and never checks stock. Any signed-in user can sell at $0, invent totals, or deduct stock from another tenant's products. A failed `sale_items` insert is only `console.error`d (`:174-180`), so a sale can record with no line items (see §5, B1).

**S9 — AI executor performs no role check of its own.** `lib/ai/executor.ts:10-16` takes `profile` as a parameter and never verifies `profile.role`; the only gate is `app/api/ai/chat/route.ts:15-24` (401/403, owner-only). The owner-only restriction is a single point of failure — any future caller of `executeErpTool`/`runErpAgent` (or a route regression) exposes 18 write tools to any user. See §6.

### MEDIUM

**S10 — AI chat: no rate limiting, no input/token limits, no confirmation, prompt-injection-prone by design.** `app/api/ai/chat/route.ts` has no rate limit, no body-size/message-count cap; `lib/ai/gemini-client.ts` sets no `max_tokens` in either provider call (only `MAX_LOOPS = 5` caps tool rounds, `:123,237,406`). The system prompt tells the model it has "direct authorization to manipulate the live database", to "call the appropriate tool immediately", and to "infer sensible defaults" (`gemini-client.ts:7-9,15,18,21`). No confirmation step before financial writes (`mark_payroll_paid`, `create_sale_checkout`, `log_expense` auto-`approved` at `executor.ts:788`). See §6.

**S11 — PostgREST filter injection via string-interpolated `.or()` / `.ilike()`.** `lib/ai/executor.ts:129,167,210,289,514,696,1081,1116` build `.or(\`name.ilike.%${input}%…\`)` with raw model/user input; `:356,392,403,858,901,1027` do the same in `.ilike('%${…}%')`. Commas in input break the `or=` filter syntax and `%`/`_` act as wildcards, so a search can match unintended records (first-match `limit(1)` then drives the write). Not classic SQLi (no raw SQL/`.rpc` found), but attacker-controlled query logic.

**S12 — `updateTaskStatus` lets any user change any task.** `app/actions/tasks.ts:88-102` checks only that a profile exists, then updates by bare `taskId` with no org check and no assignee/ownership check. An `employee` can mark others' (or another tenant's) tasks complete, though `getTasks` (`:7-33`) correctly scopes employees to their own tasks.

**S13 — `markAttendance` writes cross-tenant with no validation.** `app/actions/employees.ts:220-256`: role-gated to admin/owner/manager, but `employee_id` is never verified to belong to the caller's org and `status` is upserted raw with no enum check. Attendance can be forged for another tenant's employees with arbitrary status values.

**S14 — Unauthenticated service-role action leaks org info.** `app/actions/organization.ts:8-20` (`getPublicBrand`) uses `createAdminClient()` with no auth check and returns the first organization's `name`/`logo_url` (`.limit(1).maybeSingle()` with **no ordering** — nondeterministic which org, and the wrong org's name/logo can appear on the login page); called from the public login page (`app/(auth)/login/page.tsx:20-25`). Low data sensitivity, but a service-role-backed endpoint reachable by anyone.

**S15 — SVG logo upload to a public bucket (stored-XSS vector).** `app/actions/organization.ts:111-128,129-170`: `uploadOrganizationLogo` allows `image/svg+xml`, uploads via the service-role client to the `organization-assets` bucket, and publishes it via `getPublicUrl`. A malicious owner (or an attacker who reaches this owner-gated action) can host a script-bearing SVG on a trusted Supabase domain.

**S16 — No input validation framework; raw FormData/JSON everywhere.** Zero matches for `zod`/`safeParse` in the repo; actions do only presence checks (e.g. `inventory.ts:110`, `sales.ts:24`), with `parseFloat`/`parseInt` and no NaN/range/length checks, and `auth.ts:6-15` passes raw email/password to Supabase. Malformed, negative, or oversized values reach the DB unchecked (negative `quantity`/`amount`, huge `limit` in `executor.ts:1170` `query_sales_history`).

**S17 — No rate limiting or lockout on login.** `app/actions/auth.ts:6-26` (`login`) has no throttling, CAPTCHA, or lockout, and returns Supabase's raw `error.message`. Unlimited credential-stuffing/brute-force attempts against any account.

**S18 — Gemini API key sent as a URL query parameter.** `lib/ai/gemini-client.ts:228`: endpoint is `…:generateContent?key=${apiKey}`. The key can land in server/proxy logs and error output; upstream error bodies are also returned verbatim to the client (`app/api/ai/chat/route.ts:44-49`, `lib/ai/gemini-client.ts:143-146`).

### LOW

**S19 — Dashboard layout never redirects unauthenticated users.** `app/(dashboard)/layout.tsx:12-16` calls `getUserProfile()` but renders anyway with `role || 'employee'` if null; it relies entirely on middleware. Defense-in-depth gap (matters combined with S3).

**S20 — `checkAccess`'s redirect is swallowed by `try/catch` in actions.** Pattern at `employees.ts:25,135,221`, `expenses.ts:19,69`, `payroll.ts:9,68`, `inventory.ts:99,149,189`, `tasks.ts:52,106`, `vendors.ts:20,68`: `checkAccess` denies by throwing `redirect()`, which the `catch` converts into a returned `{ error }`. Currently still blocks (no bypass found), but the pattern is fragile — a future edit that ignores the return value would silently allow the write.

**S21 — Dead public routes and no self-service auth flows.** `lib/supabase/middleware.ts:6` treats `/register` and `/auth*` as public, but no register page or `/auth/callback` route exists; there is no signup, password-reset, or email-verification flow — account creation is only via the admin client in `employees.ts:78-108` (with `email_confirm: true` and no password-strength check in app code). Password resets depend on out-of-band processes.

**S22 — `getOrganization` takes an arbitrary `organizationId` with no membership check.** `lib/auth-utils.ts:22-31`. Low on its own (only called with the caller's own org from the dashboard layout), but any future caller could read any org's full row.

**Clean (checked, no issue found):** no CORS headers set and no `redirect`/`next`/`returnTo` parameter is honored anywhere; login redirects to a fixed `/dashboard` (`auth.ts:25`) — no open redirect. No `dangerouslySetInnerHTML` in the AI markdown renderer (`components/ai/markdown-content.tsx` uses React text nodes).

## 5. Bugs / code quality

### Correctness — money (HIGH)

**B1 — Checkout is non-atomic and reports success on partial failure.** `app/actions/sales.ts:108-183` (`processCheckout`): the sale header is inserted first, then `sale_items` + `inventory_movements` are fired in `Promise.all` (`:148-169`). If either fails, `:172-178` only `console.error` it and `:185` still returns `{ success: true, invoice_number }`. POS then shows "Sale completed and stock deducted successfully" (`pos-client.tsx:378-380`). In production: a paid sale with no line items, or no stock deduction — stock and revenue silently diverge, with no retry/compensating path. There is no `.rpc()` anywhere in the repo — no transaction/RPC for any multi-step write (same shape in `processReturn`, `receivePurchaseOrder`, `createBatch`).

**B2 — Checkout trusts the client for prices, quantities, total, and stock.** `sales.ts:59-64,121-127`: `unit_price`, `subtotal`, `totalAmount` come straight from the POS cart; the server never re-reads `products.selling_price`, never checks stock, never recomputes Σ qty×price. `pos-client.tsx:50-68` (`addToCart`) has no stock cap, no search, no quantity limit. Overselling to negative stock, and a tampered request can sell at $0.01 with an arbitrary total while `subtotal = total_amount = totalAmount` (`:121-122`) is stored as truth.

**B3 — Invoice numbers can collide.** `sales.ts:108`: `` `INV-${Date.now().toString().slice(-6)}` `` — only the last 6 digits of ms time (≈16 minutes of uniqueness, 1 ms granularity). Two checkouts in the same millisecond produce the same number; same pattern in `returns.ts:66` (`RET-…`). If `invoice_number` is unique, the second checkout fails after the customer was charged/shown success; if not unique, `getInvoiceByNumber` (`sales.ts:188-223`, `.maybeSingle()`) breaks.

**B4 — `total_spent` is a lost-update race.** `sales.ts:155-168` and `returns.ts:131-144`: read `total_spent`, add/subtract in JS, write back — no atomic increment, no row lock. Two concurrent checkouts/returns for one customer lose one update.

**B5 — Purchase receiving is unauthenticated, unchecked, and double-receivable.** `purchases.ts:104-172` (`receivePurchaseOrder`): no `checkAccess`, no org check, no quantity/status validation, and **none** of the four writes checks its error (`:123-160`: PO status, item `received_quantity`, batch insert, movement insert are bare `await`s). `receive-button.tsx:12-20` also ignores the returned result. Any signed-in employee can receive any PO, and clicking twice creates a duplicate batch (`${po_number}-RECV`, `:145` — no uniqueness handling) and double-counts stock. Expiry is hardcoded "+30 days for demo" (`:135-136,147`).

**B6 — Returns trust the client and never validate against the original sale.** `returns.ts:28-35,66-67,121-146`: no check that `sale_id` exists, that the product was on that sale, that returned qty ≤ sold qty, or that `refund_amount` ≤ paid amount; `return_action` is an unchecked string. `Promise.all(tasks)` result is never inspected (`:146`). Refunds exceeding the sale, restocking items never sold, repeated returns of the same sale.

**B7 — Payroll regeneration overwrites paid payroll; paying is not idempotent.** `payroll.ts:40-47`: `generatePayroll` upserts every active employee with `status: 'draft', deductions: 0, bonuses: 0, net_salary: base_salary` on conflict `employee_id,month,year` — re-running it for a month already paid resets paid rows to draft at full salary. `payPayroll` (`:66-79`): no org check, no `status='draft'` guard, no payment/ledger record — marking an already-paid row paid again (or any UUID) succeeds silently. No month/year validation either (`payroll.ts:8,55`; `payroll/page.tsx:19-20` does `parseInt` with no 1–12/range check, so month 0/13/NaN yields an empty register). Attendance/deductions are never factored in — `deductions: 0` always.

**B8 — Employee creation can orphan an Auth user; update silently half-applies.** `employees.ts:74-111`: Auth user + `profiles` row are created first; if the `employees` insert (`:113`) then fails, the login/profile remain with no employee record and the caller only sees the employee error. `updateEmployee` (`:170-175`): the `profiles.role` update result is ignored; `:177-190` swallows the Auth ban/unban failure (`catch { console.error… }` with an explicit "don't return error" comment) — a deactivated employee can stay able to log in. `base_salary` is `parseFloat(...)` (`:33,143`) with no NaN/range check, so a blank/invalid salary can be stored as NaN.

### Error handling (HIGH/MEDIUM)

**B9 — `checkAccess` redirects are swallowed everywhere.** `lib/auth-utils.ts:31-43` enforces denial via `redirect()`, which throws. Every caller wraps it in `try { await checkAccess(...) } catch { return { error: 'Unauthorized' } }` — e.g. `employees.ts:25,135,221`, `expenses.ts:19,69`, `inventory.ts:99,149,189`, `payroll.ts:9,68`, `tasks.ts:52,106`, `vendors.ts:20,68`. Net effect: unauthenticated users get an "Unauthorized" string instead of a login redirect, and wrong-role users never reach `/dashboard?error=unauthorized`. Authorization still holds (the action aborts), but the UX/security flow is broken by the pattern itself.

**B10 — Getters `throw`, mutations return `{error}` — pages crash with no boundary.** All list getters do `if (error) throw new Error(error.message)` (e.g. `inventory.ts:14,93,244,278,370`; `sales.ts:13`; `employees.ts:20`; `vendors.ts:14`). There is **no `error.tsx`** in the repo, so one DB error takes down the whole list page instead of showing an empty/error state. Conversely `getTasks`/`getVendorOrders` (`tasks.ts:27-31`, `vendors.ts:117-120`) swallow errors and return `[]` — indistinguishable from "no data".

**B11 — UI ignores action results; errors surface only via `alert()`.** `pay-button.tsx:12-16` and `receive-button.tsx:12-20` `await` the action and discard the result — a failed pay/receive looks successful. `dashboard-client.tsx:44-56`: `updateTaskStatus` returns `{error}` on failure (it never throws, `tasks.ts:87-101`), so the `try/catch` never fires and the task is removed from local state even when the server update failed. Other forms use `alert(result.error)` (`pos-client.tsx:116`, `employee-form.tsx:24`, `return-form.tsx:34`, `task-form.tsx:35`, `generate-payroll-button.tsx:19`). No form uses `useActionState`/inline error UI.

**B12 — More swallowed writes.** `inventory.ts:422-429` (`createBatch`): the compensating `inventory_movements` insert after the batch insert is unawaited-for-error — batch exists, stock movement silently missing, `success: true` returned. `sales.ts:174-178` as B1. `employees.ts:107-109` (`createEmployee` catch discards the real error and returns a generic "Ensure SUPABASE_SERVICE_ROLE_KEY is set", hiding e.g. duplicate-email).

### Data fetching / performance (HIGH/MEDIUM)

**B13 — Unbounded whole-table reads; no pagination anywhere.** No `.limit()`/`.range()` and no pagination UI on any list page except `getMovements(limit = 200)` (`inventory.ts:261`) and the dashboard's recent-6. Unbounded: `getProducts`, `getCustomers`, `getEmployees`, `getCategories`, `getVendors`, `getPurchaseOrders` (with nested `purchase_order_items`), `getReturns` (with nested items), `getExpenses`, `getBatches`, `getTasks`, `getAssignees`. POS (`sales/pos/page.tsx:14-18`) loads **all** products + customers on every visit and renders every product card (`pos-client.tsx:230-243`). Pages slow linearly and eventually time out as tables grow.

**B14 — Stock is computed by fetching every movement, in JS, on every load.** `inventory.ts:228-259` (`getStockLevels`): selects all active products with **all** nested `inventory_movements(quantity)` and sums in JS. Called by the stock page, by `getDashboardStats` (`:435-440`), and by the dashboard (`dashboard.ts:39,156-170`) — i.e. the dashboard re-downloads the entire movement history just to count low-stock items. No aggregate/RPC, no `products.current_stock` column. Cost grows with total history, not with products.

**B15 — Reports/dashboard fetch all-time history and aggregate client-side (JS).** `reports.ts:25-48`: all `sales` (unbounded, all time), all `inventory_movements`, all `purchase_orders`, all `expenses`, all `payroll` — then `forEach` sums in JS (`:73-223`). `sale_items` is capped at an arbitrary `.limit(500)` (`:32`) and dashboard top-products at `.limit(300)` (`dashboard.ts:73-76`): "top products" and COGS are silently computed from only the **latest 300/500 rows**, so figures become wrong without any indication once volume exceeds the cap. Same for P&L (`reports.ts:177-199`, COGS from the truncated set). No per-row N+1 loop was found — the problem is the opposite: giant single fetches + JS aggregation.

**B16 — Dashboard quirks.** `salesGrowth` is set to `100` when last month had zero sales (`dashboard.ts:86` — misleading, not a real %); "Top Products" is computed from only the last 300 `sale_items` (`dashboard.ts:71-75`); `getCheeseCommandCenterData` is not org-scoped on several queries; `dashboard.ts:159,170` filters for status `'Out of Stock'`, but `getStockLevels` (`inventory.ts:256`) only ever returns `'Low Stock'` or `'In Stock'` — the `'Out of Stock'` branch can never fire (a 0-stock product shows "Low Stock").

### Money / numbers (MEDIUM)

- **Floats everywhere, no integer paisa/cents, no currency helper.** `lib/utils.ts` is 6 lines — only `cn()`. Every amount is a JS `number` (`parseFloat`, `quantity * unit_price` in `purchases.ts:67`, `Number(total) + totalAmount` in `sales.ts:165`), displayed with ad-hoc `` `$${x.toFixed(2)}` `` in 5+ client files. Currency is hardcoded `$` although the business context is PKR. `0.1 + 0.2`-class drift accumulates in `total_spent`, COGS, and P&L sums.
- **Negative / NaN / fractional quantities pass validation.** `parseInt` truncates fractional quantities (`inventory.ts:285,377`; `purchases.ts:28`); `!quantity` rejects 0/NaN but negative values are silently `Math.abs`'d in `createMovement` (`inventory.ts:330-352`) while negative `amount` passes `createExpense` (`expenses.ts:72-74`, `!amount` is false for `-5`); negative `refund_amount` passes `processReturn`. `base_salary` NaN (B8). `selling_price`/`cost_price` are `parseFloat` with no `> 0` / finite check (`inventory.ts:134-135,173-174`).

### Dates / timezones (MEDIUM)

- **UTC "today" vs local month boundaries are mixed in the same function.** `dashboard.ts:14-17`: `month`/`year` from local `getMonth()`, but `todayStr = date.toISOString().split('T')[0]` is UTC; `reports.ts:14-21`: `todayStr` UTC, `sevenDaysAgo` local, `firstDayOfMonth = new Date(y, m, 1).toISOString()` — local midnight converted to UTC, so the month starts at 05:00 PKT. `dashboard.ts:97-99,109-115`: trend keys are UTC dates while `dayNames[d.getDay()]` is local — around midnight (19:00–24:00 PKT) sales land on the wrong day and "today" totals disagree between dashboard and reports. `payroll.ts:73`: `payment_date` is the UTC date. Expiry windows computed from local `new Date()` vs date-only strings parsed as local midnight, with `Math.ceil` day math (`dashboard.ts:178-186`) — off-by-one on expiry alerts at day boundaries.
- **Dead date variable:** `sevenDaysAgoStr` computed but never used (`reports.ts:19`). Payroll month-boundary logic is absent: `generatePayroll` ignores attendance and month length entirely (B7); no pro-rata / joining-date handling.

### Duplication / types / dead code (MEDIUM/LOW)

- **"Get-or-create Main Branch" copied 5×:** `sales.ts:74-93`, `inventory.ts:304-319` (createMovement; `createBatch` at `:389-397` only reads it and errors instead), `employees.ts:56-72`, `purchases.ts:49-64`, `returns.ts:46-61`. Same select-`limit(1)`, same insert, same error string. A race can also create duplicate "Main Branch" rows (no unique guard visible in code).
- **"Auth → profile → organization_id" copied ~16×:** `from('profiles').select('organization_id')…single()` + `if (!profile) return { error: 'Profile not found' }` appears in nearly every create action. No shared `requireProfile()`/`requireOrg()` helper despite `lib/auth-utils.ts` existing for exactly this.
- **Payment/movement-type normalization + `Array.isArray(x) ? x[0] : x` guards repeated:** payment enum mapping `sales.ts:111-128`; movement mapping `inventory.ts:322-352`; the Supabase-relation array guard repeats in `dashboard.ts:123,140`, `reports.ts:109,138,163` (symptom: the Supabase client is untyped — no generated `Database` types — so every relation is defensively re-checked).
- **Stats logic duplicated:** `inventory.ts:435-476` (`getDashboardStats`) re-implements most of `dashboard.ts:8-228` (`getCheeseCommandCenterData`); both are live exports.
- **Money formatting duplicated:** `` `$${….toFixed(2)}` `` in at least 5 client files; no `formatCurrency`/`formatDate` helper in `lib/utils.ts`.
- **`any` is pervasive:** `dashboard.ts` (~15×), `reports.ts` (~10×), `inventory.ts:247,249,440`, `sales.ts:148` (`PromiseLike<any>[]`), `returns.ts:92,121`, `auth.ts:6` (`prevState: any`), `employees.ts:107` / `organization.ts:168` (`catch (err: any)`), plus `any[]` props in `pos-client.tsx:37`, `reports-client.tsx:19`, `stock/page.tsx:47`, `payroll/page.tsx:60`. Supabase responses are untyped, so amounts, prices, and relation shapes are all unchecked. **Unsafe `as string` casts on `FormData.get()`** throughout (`inventory.ts:121-138`, `sales.ts:20-23`, `employees.ts:27-38`, …): `FormData.get()` returns `string | File | null`; casting null to string hides missing-field bugs, which is why NaN/empty values reach the DB. No `@ts-ignore` / `@ts-expect-error` found — the suppression mechanism used is `any` + `as` casts instead.
- **Dead code:** `getExecutiveDashboardStats` (`dashboard.ts:230-241`) — zero callers; `getDashboardStats` (`inventory.ts:435-476`) — zero callers; `checkAccess` imported but unused in `reports.ts:4`; `sevenDaysAgoStr` unused (`reports.ts:19`); `revalidatePath('/sales/history')` (`sales.ts:182`) — no `/sales/history` route exists; two different `getOrganization`s (`lib/auth-utils.ts:22-30` vs `app/actions/organization.ts:22-41`) — same name, different contract; `components/ai/owner-ai-assistant.tsx` — 788-line duplicate AI assistant, imported nowhere (see §6); `components/expensive-ambient-mesh.tsx` — decorative ambient gradient rendered on every dashboard page (its cost was not measured).
- **Server/client boundary — checked, no issue found:** client components import server actions only; no client file imports `lib/supabase/server`, `admin`, or Node-only code; no server file imports client components. `createAdminClient` is statically imported in `organization.ts:3` (server-only — fine) but lazily imported in `employees.ts:78,180` — inconsistent, not a bug.

## 6. AI chat system

### Provider / model / config

- **Primary provider is OpenRouter, not Gemini, when its key is set.** `lib/ai/gemini-client.ts:326-330`: if `OPENROUTER_API_KEY` is present, `runOpenRouterAgent` runs first; Gemini is only a fallback (`:335-340`) or the sole provider if no OpenRouter key (`:351-354`). If neither key exists, the user gets a "set `OPENROUTER_API_KEY` or `GEMINI_API_KEY`" message (`:364`).
- **Models:** OpenRouter model is `process.env.OPENROUTER_MODEL || 'openrouter/free'` (`:101`, repeated `:383`) — `'openrouter/free'` is a routing alias, not a concrete model id. Fallback list is `[primary, 'openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free']` (`:102-110`). Gemini model is `process.env.GEMINI_MODEL || 'gemini-3.6-flash'` (`:227`). No SDK is used; both are direct `fetch` calls to `https://openrouter.ai/api/v1/chat/completions` (`:110`) and `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}` (`:228`) — the Gemini key is sent **in the URL query string** (S18).
- **Streaming is fake.** The route returns SSE (`app/api/ai/chat/route.ts:36-44`), but `runOpenRouterAgentWithStreaming` does a **non-streaming** `fetch`, waits for the whole response, then re-chunks the completed text into 16-char slices every 12 ms (`gemini-client.ts:461-468`); the Gemini path goes through the non-streaming `runErpAgent` and is chunked the same way (`:541-552`). There is no true token streaming from either provider.
- **Temperature 0.2** in all three agent loops (`:141,253,425`). **No `max_tokens`, no context/token limit, no fetch timeout / `AbortSignal`, no max message length, no request-body size check** anywhere in `lib/ai/` or `app/api/ai/chat/route.ts`.
- **Turn/tool-call cap:** `MAX_LOOPS = 5` in all three loops (`:123,237,406`). Each loop can execute *multiple* tool calls in parallel (OpenRouter path iterates all `tool_calls`, `:476-500`), so one request can commit well over 5 writes.

### Tools — 25 declared, 18 write / 7 read

All declared in `lib/ai/tools.ts:16` (`ERP_TOOLS`); all executed by the `switch` in `lib/ai/executor.ts:11-1330`. There is **no delete tool** (nothing deletes any row), but also no void/refund/cancel tool for sales.

| Tool | R/W | Tables touched | What it does |
|---|---|---|---|
| `create_product` | WRITE | `products` insert; `categories` select/insert; `inventory_movements` insert if `initial_stock` | Creates product, auto-creates category, auto-generates SKU `SKU-<timestamp>` if omitted; optional opening stock (`executor.ts:42-120`) |
| `update_product` | WRITE | `products` select/update | Fuzzy-matches first product by name/SKU (`ilike`, `limit(1)`), updates prices/name/min-stock (`executor.ts:122-158`) |
| `adjust_inventory_stock` | WRITE | `products` select; `inventory_movements` insert | Records STOCK_IN / STOCK_OUT / WASTAGE / RETURN / ADJUSTMENT; negative qty for OUT/WASTAGE (`executor.ts:160-201`) |
| `create_product_batch` | WRITE | `products` select; `product_batches` insert; `inventory_movements` insert | Registers batch + auto STOCK_IN movement; **second insert's error is unchecked** (`executor.ts:203-252`) |
| `query_inventory` | READ | `products`, `categories`, `inventory_movements`, `product_batches` | All / low-stock / expiring-≤30-days / search; stock computed by summing all movements in JS (`executor.ts:254-318`) |
| `create_vendor` | WRITE | `vendors` insert | Registers supplier (`executor.ts:320-347`) |
| `update_vendor` | WRITE | `vendors` select/update | Fuzzy name match, first hit only (`executor.ts:349-383`) |
| `create_purchase_order` | WRITE | `vendors`, `products` select; `purchase_orders` + `purchase_order_items` insert | Creates PO with status hard-coded `'sent'`; **items insert error unchecked** (`executor.ts:385-445`) |
| `query_vendors_and_orders` | READ | `vendors`; `purchase_orders` + `purchase_order_items` + `products` | Lists vendors or last 10 POs (`executor.ts:447-472`) |
| `create_employee` | WRITE | `employees` insert | Adds employee with salary/role (`executor.ts:474-505`) |
| `record_attendance` | WRITE | `employees` select; `attendance` select then update-or-insert | Upserts one day's attendance incl. times/notes (`executor.ts:507-563`) |
| `mark_bulk_attendance` | WRITE | `employees` select; `attendance` upsert per employee | Marks many staff present/absent in one call, incl. `default_status_for_others` applied to **everyone else**; fuzzy name matching (`executor.ts:565-649`) |
| `generate_monthly_payroll` | WRITE | `employees` select; `payroll` upsert | Creates draft payroll slips for **all** active employees, net = base salary, deductions/bonuses 0 (`executor.ts:651-687`) |
| `mark_payroll_paid` | WRITE | `employees` select; `payroll` update | Sets slip `status='paid'` + today as `payment_date`; **no check any row was actually updated** (`executor.ts:689-725`) |
| `query_employees_and_attendance` | READ | `employees`; `attendance` + `employees` | Staff list incl. salaries, or one day's attendance (`executor.ts:727-761`) |
| `log_expense` | WRITE | `expense_categories` select/insert; `expenses` insert | Logs expense, auto-creates category, **`status: 'approved'` hard-coded** — no approval step (`executor.ts:763-818`, `:801`) |
| `query_financial_summary` | READ | `sales`, `expenses` | Revenue/expenses/net for today / this month / all time, summed in JS (`executor.ts:820-847`) |
| `create_task` | WRITE | `profiles` select (assignee lookup); `tasks` insert | Assigns task, status `'pending'` (`executor.ts:849-892`) |
| `update_task_status` | WRITE | `tasks` select/update | Fuzzy title match, first hit only (`executor.ts:894-924`) |
| `query_tasks` | READ | `tasks`, `profiles` | Lists tasks by status (`executor.ts:926-951`) |
| `update_organization_info` | WRITE | `organizations` update | Renames/recontacts the whole business (`executor.ts:953-975`) |
| `query_organization_info` | READ | `organizations` select | Business name/phone/email/address (`executor.ts:977-991`) |
| `create_customer` | WRITE | `customers` insert | Registers customer (`executor.ts:993-1017`) |
| `create_sale_checkout` | WRITE | `products`, `customers` select/update (`total_spent`); `sales`, `sale_items`, `inventory_movements` insert | **Full POS checkout**: creates invoice `INV-<ts>`, sale lines, STOCK_OUT movements, bumps customer `total_spent`. Accepts a caller-supplied per-item `unit_price` override (can sell at $0/arbitrary price), accepts `CREDIT`, and **never checks stock availability before deducting** (`executor.ts:1041-1247`) |
| `query_sales_history` | READ | `sales`, `sale_items`, `products`, `customers` | Sales/invoices/revenue for a period or N days, default limit 50 (`executor.ts:1249-1310`) |

**Extra executor-only case:** `query_customers` (`executor.ts:1019-1039`, READ on `customers`) exists in the executor but is **not declared in `tools.ts`** — the model is never offered it, so it is unreachable in normal operation, but it *would* execute if the model hallucinated/invented that tool name. Conversely every declared tool has an executor case.

**Non-atomicity:** `create_sale_checkout` inserts the sale, then `Promise.all`s `sale_items` + `inventory_movements` + the customer-total update (`executor.ts:1225`) — no DB transaction, so a partial failure can leave an invoice without lines/stock movement. `create_product_batch` and `create_purchase_order` similarly ignore the error of their second insert.

### Authorization — owner-only at the gate, thin elsewhere

- **Route: owner-only.** `app/api/ai/chat/route.ts:8-22`: `getUserProfile()` → 401 if not signed in, **403 unless `profile.role === 'owner'`**. So **not any signed-in user can use it — admin/manager/employee are all rejected**, including for read-only tools. (This is a real difference from the older Arco codebase's known gap, where the executor never read the actor's role.)
- **Page-level gate matches:** `app/(dashboard)/chat/page.tsx:14-22` redirects unauthenticated users to `/login` and non-owners to `/dashboard?error=unauthorized`. **Sidebar gate matches:** the "AI Chat" entry and Recent Chats render only when `role === 'owner'` (`components/app-sidebar.tsx:100`, `:39`).
- **Residual gaps:**
  - **MEDIUM — executor does no role check of its own.** `executeErpTool` (`executor.ts:11-16`) accepts the `profile` object as a parameter and trusts it; it never re-validates `role === 'owner'`. The only callers are `gemini-client.ts` (`:200, :291, :486`), reached only via the gated route — defense-in-depth only, but any future caller that invokes the executor directly would get full write access with no check (S9).
  - **LOW–MEDIUM — org scoping is present but single-layer.** Nearly every query filters `.eq('organization_id', orgId)` taken from `profile.organization_id` (`executor.ts:13`, e.g. `:56, :128, :259, :458`). The backstop is Supabase RLS on the anon-key client — RLS policies themselves were **not** verified (no schema in repo), so org isolation rests on the `organization_id` filter plus unverified RLS.
  - **LOW — branch auto-creation side effect.** If no branch exists, the executor silently inserts a `'Main Branch'` row for the org (`executor.ts:19-39`) on *any* tool call, including read-only queries.
  - **LOW — fuzzy first-match resolution.** Product/vendor/employee/task lookups use `ilike %name%` + `limit(1)` (`executor.ts:128-135, 355-361, 511-517, 897-904`, etc.), so "Cheese" can silently resolve to the wrong product and a write lands on the wrong record, with no disambiguation step.

### Safety gaps

- **No confirmation before any write — HIGH.** The system prompt orders immediate execution: "You have direct authorization to manipulate the live database" and "call the appropriate tool immediately" (`gemini-client.ts:15,18`); it also orders inferring defaults so "the owner never has to deal with tedious paperwork" (`:21`). Neither `chat-client.tsx` nor `owner-ai-assistant.tsx` shows any confirm dialog — action receipts ("Database Committed") are rendered **after** the write; the only warning is a footer line, "Qurbat AI directly manipulates your live database. Check details before making critical changes". Payroll-paid, bulk-absent-everyone, org rename, expense auto-approved, and POS checkout all commit on one sentence.
- **No rate limiting / quotas / abuse controls — MEDIUM.** No rate limiter, per-user/per-org quota, or cost cap was found anywhere in the AI files or repo-wide. One request can loop 5× with multiple parallel tool calls; history is unbounded (see below), so a long session can generate large provider bills, especially if `OPENROUTER_MODEL` is set to a paid model.
- **Prompt-injection mitigations: none — MEDIUM.** The system prompt contains no instruction to ignore instructions embedded in user text, tool outputs, or DB content (product names, notes, task titles are fed back to the model as tool results, `gemini-client.ts:203-212, :297-308`). The client sends the **entire conversation history** on every turn (`chat-client.tsx:213-222`, `owner-ai-assistant.tsx:154-163`) with role mapping `assistant → 'model'`, everything else → `'user'` — a client can therefore inject fabricated `model`-role messages claiming prior tool success. No input sanitization, no allow-listing of tool arguments beyond the model, and no server-side validation of amounts/prices/quantities (e.g. negative amounts, `unit_price: 0` in checkout).
- **No audit trail of AI writes — MEDIUM.** Successful tool executions are only returned in the SSE `action` event and stored client-side in localStorage; server-side there is only `console.error` on failures (`gemini-client.ts:147,155,265,335`; `executor.ts:1322-1328`). No `audit_logs` / `ai_actions` table insert exists anywhere in `lib/ai/` (repo-wide grep for `audit_log|ai_action` returned nothing). A bad AI write is discoverable only by noticing the changed business data.
- **Unbounded context — LOW.** Full history is re-sent every turn with no truncation/summarisation (`chat-client.tsx:213-222`); combined with no `max_tokens`, long sessions grow cost and can hit provider context limits with an opaque error.
- **Reasoning leak (minor contradiction).** The system prompt says "NEVER output your internal thinking", yet the streaming path explicitly forwards `choice.reasoning` / `reasoning_content` and `<think>…</think>` contents to the UI as `thinking` events (`:441-449`) and renders them in a collapsible "Thought Process" block (`chat-client.tsx`, `ThinkingBlock`).
- **Positive note:** `markdown-content.tsx` renders model output with a hand-rolled parser using React text nodes — no `dangerouslySetInnerHTML` — so model output cannot inject HTML/JS there (links get `target="_blank" rel="noopener noreferrer"`). The only `innerHTML` in the AI UI is `invoice-modal.tsx:195`, where the already-React-rendered receipt DOM is copied into a print window.

### Storage — localStorage only, not a database, not org-scoped

- `lib/ai/chat-storage.ts:24` uses `localStorage` key `qurbat_ai_chat_sessions`; there is **no Supabase table** for chat sessions/messages, no server-side history, no per-user or per-org scoping. `getChatSessions()` (`:110-122`) reads/writes that key in the browser.
- **History is per-browser, not per-user:** anyone signing in on the same browser/device sees the previous user's sessions (including tool-action receipts naming products, salaries context, invoices), and history is not cleared on logout. It also does not sync across devices.
- **Seeded fake history:** on first load the store is seeded with three fabricated `DEFAULT_SESSIONS` (`chat-storage.ts:26-108, :116-117`) — "Inventory & Stock Audit" (Smoked Cheddar 6 units), "Daily Staff Attendance", "Operational Expenses Review" ($3,420.00) — presented in the sidebar Recent Chats as if they were real past conversations. These are invented numbers, not from the database.
- Sessions are created client-side from the first prompt (`createNewSession`, `:143-160`), saved after every turn (`chat-client.tsx`, `saveChatSession` calls), deleted via `deleteChatSession` (`chat-storage.ts:134+`), and listed in the sidebar for owners only (`app-sidebar.tsx:35-60, :138+`). The floating assistant (`owner-ai-assistant.tsx`) keeps its messages **only in React state** — closing the drawer loses them, and they never touch `chat-storage.ts`.

### UI — what exists, what is reachable, what is dead

- **`/chat` (the real UI):** server page gates to owner (`chat/page.tsx:14-22`) and renders `ChatClient`. `chat-client.tsx` is a ChatGPT-style single-column page: empty state ("Where should we begin?") with quick-action menu (Add Product / Log Attendance / Record Expense / Assign Task — each fires a canned prompt, e.g. `:485`), a pinned bottom input once messages exist, SSE handling for `status` / `thinking` / `action` / `delta` / `error` events, per-message "Database Committed" receipts with Success/Failed badges, and a **"View & Print Invoice"** button only on `Sale Checkout Completed` actions that opens `InvoiceModal`. `?session=<id>` loads a stored session; `?topic=products|attendance|expenses|tasks` auto-fires a preset prompt (`chat-client.tsx`, `TOPIC_PRESETS`). Two buttons are decorative: **Think** toggles local state (`thinkMode`, `:101`) that is never sent to the API, and **Mic** has no handler at all (`:463, :708`).
- **Floating drawer (`OwnerAIAssistant`): DEAD CODE.** `components/ai/owner-ai-assistant.tsx:111-112` exports the component with an `isOwner` gate and a fixed bottom-right "Owner AI Agent" button + slide-over drawer that duplicates the full `/chat` client (same `/api/ai/chat` SSE handling, same invoice modal). **It is imported nowhere** — repo-wide grep finds only its definition; it is not mounted in `app/(dashboard)/layout.tsx` or any other file. So the assistant is reachable **only via `/chat`**, not from everywhere as the drawer was designed for. The duplicate is a second full implementation (~600–788 lines) to maintain if ever re-enabled.
- **`invoice-modal.tsx`:** read-only receipt viewer/printer. Fetches the invoice via the `getInvoiceByNumber` server action if no line items were supplied (`:60-88`), renders org branding + line items + total, prints via a new window (`:121+`). It performs no AI or write operation.
- **`markdown-content.tsx`:** presentation-only custom Markdown renderer (headings, tables, lists, code blocks, bold/italic/code/links), used by both chat UIs.

### AI verdict

**The AI chat is safe to expose to the owner only, in its current gated form — it must not be exposed to all signed-in users.** The owner-only enforcement is real and layered consistently at the API route (`app/api/ai/chat/route.ts:17`), the page (`chat/page.tsx:20`), and the sidebar (`app-sidebar.tsx:100`); an admin, manager, or employee gets a 403/redirect. However, *within* the owner role the agent is an unguarded operator, not a safe analyst: it executes financial and payroll writes immediately with no confirmation, no audit log, no rate limit, no input validation, fuzzy first-match record resolution, non-atomic multi-table checkouts, and no prompt-injection guard — so a single misheard instruction (a wrong product name, a $0 unit price, "mark everyone absent") can silently post real transactions that leave no trace except the changed data. Keep the owner-only gate as a hard requirement, and before widening access to any other role — or before treating this as production-safe even for the owner — add per-write confirmation for financial/payroll/checkout actions, a server-side audit log of every tool execution, and a role re-check inside the executor; the dead floating drawer should either be mounted or deleted, and the fake seeded chat sessions should be removed.

The AI is **an operator, not a read-only analyst**: 18 of 25 tools write, including the highest-impact operations in the system — POS checkout with stock deduction, payroll generation and marking paid, bulk attendance, expense logging (auto-approved), product/batch/stock adjustments, and org-info edits. Everything it does mirrors an existing UI flow **except** it can do them all in one sentence, with fuzzy name matching, inferred defaults, no approval step, and no per-action permission check. What it **cannot** do that the UI can: delete anything, void/refund a sale, edit a sale, manage users/roles, or run the Reports pages — no tool covers those. It is also the only path that can create a product *and* its opening stock *and* a batch in a single utterance.

## 7. Build health (run by the coordinator, 2026-11-16)

`node_modules` was absent on arrival, so dependencies were installed first (`npm ci`, 621 packages, clean).

### Lint — FAILS

`npm run lint` → **exit 1, 174 problems (139 errors, 35 warnings)** across ~30 files. Never describe lint as passing.

| Rule | Count |
|---|---|
| `@typescript-eslint/no-explicit-any` | 110 |
| `@typescript-eslint/no-unused-vars` | 27 |
| `react-hooks/set-state-in-effect` | 8 |
| `react-hooks/rules-of-hooks` | 8 |
| `react-hooks/purity` | 1 |
| `react-hooks/exhaustive-deps` | 1 |

Concentration: `lib/ai/` dominates the `any` errors — `gemini-client.ts` (~25), `executor.ts` (10), `tools.ts` (1), `chat-storage.ts` (1). Errors also spread across `app/actions/*.ts` (auth, dashboard, employees, expenses, inventory, organization, payroll, reports, returns, sales) and components (`theme-toggle.tsx`, `organization-provider.tsx`, `app-sidebar.tsx`, `owner-ai-assistant.tsx`, `invoice-modal.tsx`, `tasks/*`, `hooks/use-mobile.ts`, `proxy.ts`, `lib/supabase/middleware.ts`, `app/api/ai/chat/route.ts`). The 8 `rules-of-hooks` errors are real hook violations, not style nits.

### Build — PASSES

`npm run build` → **compiled successfully in 33.3s, TypeScript clean, 27 pages generated.** Route table (24 routes):

| Route | Type |
|---|---|
| `/`, `/login` | ○ Static |
| `/api/ai/chat`, `/chat`, `/dashboard`, `/employees/attendance`, `/employees/list`, `/employees/payroll`, `/expenses/cashflow`, `/expenses/categories`, `/expenses/ledger`, `/inventory/batches`, `/inventory/categories`, `/inventory/movements`, `/inventory/products`, `/inventory/stock`, `/purchases/orders`, `/purchases/vendors`, `/reports`, `/sales/customers`, `/sales/pos`, `/sales/returns`, `/settings`, `/tasks` | ƒ Dynamic (server-rendered on demand) |

One cosmetic warning: Turbopack notes `package-lock.json` in `/home/hatch` is outside the git repo and was ignored (set `turbopack.root` in `next.config.ts` if that matters).

### Tests

**None.** No test script in `package.json`, no test files, no test framework installed. The build passing is the only automated check that exists.

## 8. Docs — what exists vs what is missing

| Exists | Content |
|---|---|
| `README.md` (36 lines) | Default `create-next-app` boilerplate, untouched. Says nothing about the project. |
| `AGENTS.md` (9 lines) | Next.js agent-rules boilerplate (auto-added by `next dev`). No project conventions. |
| `CLAUDE.md` (1 line) | `@AGENTS.md`. |
| `components.json` | shadcn config only. |

| Missing | Why it matters |
|---|---|
| Database schema / migrations / seed | The DB cannot be recreated from the repo; table/column/enum/RLS definitions live only in the unseen Supabase project. This is the single biggest reproducibility gap. |
| `.env.example` | 7 env vars are referenced in code (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) but documented nowhere. |
| Setup guide | No install/run/seed steps, no required Supabase project setup, no first-user/owner creation procedure. |
| Deployment guide | No Vercel/hosting notes, no env-var checklist for production, no note that the middleware fails open when Supabase env vars are missing (S3). |
| Roles & permissions doc | Roles exist in code (`owner/admin/manager/employee`) but the intended permission matrix is undocumented — and the code enforces it inconsistently. |
| AI setup doc | No note that OpenRouter is tried first, Gemini is the fallback, which models are used, that the key in `scratch/test-openrouter.js` must be rotated, or that chat is owner-only by design. |

## 9. What could NOT be verified

- **Anything needing a live database.** There is no DB on this machine and none in the repo: RLS policies (the single biggest open question — S2), actual data flows, auth behaviour at runtime, whether the committed OpenRouter key is still active (format-valid; the key was **not** called to check it), and live AI behaviour were all unverified.
- **Runtime behaviour of any page.** All "WORKING" verdicts in §2 are static: the code path is fully wired to real Supabase calls. Nothing was executed against a database.
- **The live Supabase project's configuration.** Project URL/keys, RLS, Storage bucket policies (`organization-assets`), and Auth settings are all unseen.
- **Whether the committed key has already been abused.** Only OpenRouter account activity would show that.

## 10. Fix priority (if this goes live)

1. **Rotate the committed OpenRouter key now and purge it from git history** (S1). Delete `scratch/test-openrouter.js`.
2. **Prove tenant isolation:** export the live schema + RLS policies into the repo as migrations and verify them; until then, treat every RLS-conditional finding as live.
3. **Atomic financial writes via Postgres RPC**, with server-side price/stock/total verification and idempotency keys — checkout, returns, purchase receiving, payroll (B1–B7). Stop returning success when writes fail.
4. **Add explicit `organization_id` scoping + role checks to every server action** (S4–S7), including the read actions and `updateCategory`/`deleteCategory`; whitelist `system_role` on employee create/update.
5. **AI guardrails:** per-write confirmation for financial/payroll/checkout tools, a server-side audit log of every tool execution, a role re-check inside the executor, rate limiting, and `max_tokens`/timeouts. Keep the owner-only gate.
6. **Validate inputs** (a validation layer — zod or equivalent — on every action; month/year, quantities, amounts, payroll status transitions).
7. **Paginate lists and aggregate stock/reports in the database** (B13–B15); fix the UTC/local date mixing (PKT midnight boundary).
8. **Hygiene:** fix lint (139 errors), remove the dead floating drawer and fake seeded chat sessions, delete unused exports, add `.env.example` + real README + schema docs, add an `error.tsx`, and add at least smoke tests for checkout/payroll.

---

*Method: 4 parallel auditor agents (structure/features, security/auth, code quality/bugs, AI chat) + coordinator verification. The coordinator independently ran `npm ci`, `npm run lint`, and `npm run build`, and re-verified the committed key (`scratch/test-openrouter.js:1`), the unprotected actions (no-auth/no-org `get*` reads; `updateCategory`/`deleteCategory`), the raw `system_role` write (`employees.ts:40,96-104,172-177`), and the AI owner-only gate. No code was changed, nothing was committed, nothing was pushed. The only new file is this report (`ANALYSIS.md`, uncommitted). `node_modules/` and `.next/` were created by the install/build and are gitignored.*
