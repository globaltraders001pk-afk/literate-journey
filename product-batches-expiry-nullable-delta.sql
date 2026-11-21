-- Delta: allow product_batches without a known expiry date
-- Run once in the Supabase SQL Editor (same project as pos-full-setup.sql).
--
-- Why: batches are now created automatically whenever stock enters
-- (purchase receiving, opening stock). The expiry date is only known
-- when the supplier / goods-in note states one; inventing one (the old
-- code hardcoded "today + 30 days") put every receipt in the URGENT
-- band of the Expiry Radar. Unknown expiry is now stored as NULL.
-- The Expiry Radar already ignores NULL-expiry batches, and the
-- batches page shows "-" for them. Manual batch creation still
-- requires an expiry date in the UI.
alter table product_batches
  alter column expiry_date drop not null;
