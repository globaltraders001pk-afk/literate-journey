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
--    Returns { invoice_number, total_amount } as JSON.
--    Any raise rolls the whole sale back.
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
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric;
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

    v_total := v_total + round(v_qty * v_price, 2);
  end loop;
  v_total := round(v_total, 2);

  -- Serial minted last, under the org-row lock, in this txn.
  v_invoice_number := public.next_invoice_number(v_org_id);

  insert into public.sales
    (organization_id, branch_id, customer_id, invoice_number,
     subtotal, total_amount, payment_method, created_by)
    values
    (v_org_id, v_branch_id, p_customer_id, v_invoice_number,
     v_total, v_total, v_payment, v_user_id)
    returning id into v_sale_id;

  -- Line items + stock movements, priced from the catalog.
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_item := p_items -> i;
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::numeric;
    select selling_price into v_price
      from public.products where id = v_product_id;
    v_subtotal := round(v_qty * v_price, 2);

    insert into public.sale_items
      (sale_id, product_id, quantity, unit_price, subtotal)
      values (v_sale_id, v_product_id, v_qty, v_price, v_subtotal);

    insert into public.inventory_movements
      (organization_id, branch_id, product_id, movement_type,
       quantity, reference_type, reference_id, notes, created_by)
      values
      (v_org_id, v_branch_id, v_product_id, 'STOCK_OUT',
       -v_qty, 'sale', v_sale_id,
       'Sale ' || v_invoice_number, v_user_id);
  end loop;

  -- Atomic customer-total bump (no read-add-write-back race).
  if p_customer_id is not null then
    update public.customers
      set total_spent = coalesce(total_spent, 0) + v_total
      where id = p_customer_id and organization_id = v_org_id;
  end if;

  return jsonb_build_object(
    'invoice_number', v_invoice_number,
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

  -- The original sale must exist in the caller's org.
  select total_amount, customer_id
    into v_sale_total, v_sale_customer_id
    from public.sales
    where id = p_sale_id and organization_id = v_org_id;
  if not found then
    raise exception 'Sale not found in your organization';
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
    -- quantity being returned.
    if round(v_refund, 2) > round(v_qty * v_unit_price, 2) then
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
--    every movement into JS and summing there. Same shape the
--    app already used: 'Low Stock' at or below the minimum,
--    otherwise 'In Stock'.
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
      when coalesce(sum(m.quantity), 0) <= coalesce(p.minimum_stock_level, 0)
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
