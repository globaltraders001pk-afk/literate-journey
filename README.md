# Global Traders

POS + ERP for a cheese / dairy business, built for **Global Traders** (medical / pharma
client) on top of the `pos-system-aiagent` codebase. Next.js + Supabase, one app for
sales, stock, purchases, expenses, payroll, and reporting — plus an FBR-compliant
sales tax invoice and four stock/expiry "Radars".

## What it does

- **POS** — sell by product / SKU, cash + card, instant receipt, returns with refund.
- **Inventory** — products, batches with expiry dates, stock movements, stock levels
  with low-stock alerts, categories.
- **Purchases** — suppliers, purchase orders, receive stock against a PO.
- **Sales** — customers, sales history, returns, FBR sales tax invoice (print + copy).
- **Expenses** — categories, ledger, cash flow.
- **Payroll** — monthly payroll generation and payment, employee records.
- **Tasks** — staff task list with assignment and status.
- **Reports** — sales, stock, vendors, P&L.
- **Radars** (`/radars`, owner/admin/manager) — Expiry (alerts 4–6 months ahead),
  Stock, Inventory, Vendors. A compact alert strip also shows on the dashboard.
- **FBR invoice** — rebuilt to match the client's sample invoice exactly (PKR, 18%
  GST added at checkout because shelf prices are GST-exclusive, amount in words,
  FBR reference grid, signatures). The FBR token is stored in Settings and is
  **never printed** on the invoice; a QR code of the FBR reference shows only
  once a reference number exists.
- **AI chat** (`/chat`, owner only) — asks the system in plain language and can run
  reads and (with an explicit confirmation step) financial writes.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Postgres + Auth + RLS) — all data access is org-scoped
- Tailwind CSS + shadcn-style UI components
- AI chat via OpenRouter (primary) with a Gemini fallback

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your own values, see below
npm run dev                  # http://localhost:3000
```

Other commands: `npm run build`, `npm run lint`, `npx tsc --noEmit`.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. Never commit `.env.local`
or any real key.

| Variable | Required | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key — server only, never expose to the browser |
| `OPENROUTER_API_KEY` | For AI chat | OpenRouter key for the owner AI chat |
| `GEMINI_API_KEY` | For AI chat | Gemini key (fallback when OpenRouter is not set) |
| `OPENROUTER_MODEL` | No | Model override, e.g. `openai/gpt-4o-mini` |
| `GEMINI_MODEL` | No | Model override, e.g. `gemini-2.0-flash` |

## Database setup

Everything is in `supabase/`. Run in the Supabase SQL Editor, in this order:

1. **`supabase/pos-full-setup.sql`** — the whole schema in one file (21 tables,
   seed org "Global Traders" / invoice prefix `GT-226`, FBR invoice columns,
   GST columns). Idempotent — safe to re-run.
2. **`supabase/migrations/`** (in filename order) — applied after the full setup:
   - `20261122_enable_rls.sql` — Row Level Security on all 21 tables (org-scoped)
   - `20261122_money_transactions.sql` — atomic money transactions
   - `20261122_sale_gst_columns.sql` — GST columns on sales
   - `20261122_stock_status.sql` — stock status

Then create the first user in the Supabase **Auth** dashboard (Auth users cannot
be created by SQL) and link it to a `profiles` row with the `owner` role.
The app's login is email + password; after 5 failed attempts an email/IP is
locked out for 15 minutes.

## Deploy

Deploy on Vercel (or any Next.js host). Set the same environment variables in
the hosting project's settings — `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus the AI keys
if the chat is used. No build-time secrets are needed.

## Docs

- `FBR_RADARS_HANDOVER.md` — what the FBR invoice + four Radars are, how they
  work, and what is still pending from the client.
- `QA_AUDIT_2026-11-20.md` — senior QA audit (51 findings) and the fix program
  status. Do not treat it as a todo list without the owner's word — the owner
  decides what gets fixed and when.
- `ANALYSIS.md` — codebase analysis (routes, data model, known risks).

