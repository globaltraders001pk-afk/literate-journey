-- ============================================================
-- Migration: get_stock_levels returns a real Out of Stock status
-- and treats a 0 minimum as unset (Phase 3a, QA audit L7 / M3)
-- Date: 2026-11-22
--
-- Before this migration the RPC only ever returned 'Low Stock'
-- or 'In Stock': with minimum_stock_level 0 (the schema default,
-- and what createProduct stores when unset) the 'Low Stock' case
-- (stock <= 0) was exactly the out-of-stock case, so the
-- dashboard's 'Out of Stock' branch could never fire and the
-- LOW band could never fire either.
--
-- After it:
--   stock <= 0            -> 'Out of Stock'
--   stock <= effective min -> 'Low Stock', where the effective
--   minimum is 10 when minimum_stock_level is NULL or 0
--   (0 = unset, same rule as lib/radar-builders.ts)
--   otherwise             -> 'In Stock'
--
-- The app's stock radar recomputes the same bands from the RPC
-- rows, so this change keeps the RPC's own status string honest
-- for every other consumer (the stock page, the dashboard's
-- low-stock list before Phase 3a derived from it).
--
-- IDEMPOTENT: CREATE OR REPLACE. Run it in the Supabase SQL
-- Editor, or run supabase/pos-full-setup.sql on a fresh project
-- (Section AB contains the same function).
--
-- LIVE VERIFICATION STILL OWED: no live DB is connected to
-- this repo. After running this, check a zero-stock product
-- reports 'Out of Stock' and a product with stock 5 and no
-- minimum set reports 'Low Stock'.
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
