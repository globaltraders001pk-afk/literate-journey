-- ============================================================
-- Migration: GST columns on sales (Phase 2, QA audit C4)
-- Date: 2026-11-22
--
-- CLIENT DECISION (2026-11-22): prices are GST-EXCLUSIVE.
-- The catalog selling_price is ex-GST; GST is charged on top
-- at the org's rate (organizations.gst_rate, default 18) and
-- the customer pays subtotal + GST.
--
--   subtotal    = SUM(qty x selling_price)      (ex-GST)
--   gst_amount  = round2(subtotal x gst_rate)
--   grand_total = subtotal + gst_amount         (amount charged)
--   total_amount = grand_total
--
-- These two columns are written by public.process_checkout()
-- (20261122_money_transactions.sql) for every NEW sale.
--
-- NO BACKFILL: old sales keep gst_amount / grand_total NULL.
-- They were charged ex-GST with total_amount = subtotal, so
-- writing GST onto them would overstate what was collected.
-- The invoice display (Phase 3) treats NULL as "compute from
-- the lines at the org rate" for those old sales.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS. Run it in the Supabase
-- SQL Editor, or run supabase/pos-full-setup.sql on a fresh
-- project (CREATE TABLE sales + Section Z contain the same
-- columns).
--
-- LIVE VERIFICATION STILL OWED: no live DB is connected to
-- this repo. After running this on the live project, check a
-- new POS sale stores gst_amount / grand_total and that
-- total_amount equals grand_total.
-- ============================================================

alter table public.sales
  add column if not exists gst_amount numeric,
  add column if not exists grand_total numeric;
