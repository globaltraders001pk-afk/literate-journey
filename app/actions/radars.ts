'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile, type UserRole } from '@/lib/auth-utils'
import { getStockLevels, getBatches } from '@/app/actions/inventory'
import {
  buildExpiryRadar,
  buildStockRadar,
  buildVendorsRadar,
} from '@/lib/radar-builders'
import type {
  BatchRow,
  ExpiryRadar,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  StockLevelRow,
  StockRadar,
  StockRadarProduct,
  VendorRow,
  VendorsRadar,
} from '@/lib/radar-builders'

// The pure builders live in lib/radar-builders.ts ('use server'
// files may only export async functions, so sync builders cannot
// live here). Their result types are re-exported so existing
// import sites (radars-client, dashboard-client) keep working.
export type {
  ExpiryBand,
  ExpiryRadarBatch,
  ExpiryRadar,
  StockStatus,
  StockRadarProduct,
  StockRadar,
  VendorRadarVendor,
  VendorsRadar,
} from '@/lib/radar-builders'

// ---------------------------------------------------------------------------
// Radars: 4-6 month advance warning for a medical / pharma business.
// All four radars read real data via Supabase, scoped to the caller's
// own organization. The page gate alone is not enough — server actions
// are directly callable — so every action below first requires the
// caller's profile and only ever reads that org's rows (QA audit H3,
// 2026-11-20). Roles match the /radars page gate: owner / admin /
// manager only; employees get no radar data at all.
// ---------------------------------------------------------------------------

// Roles allowed to read radars (same list as the /radars page gate).
const RADAR_ROLES: UserRole[] = ['owner', 'admin', 'manager']

// The caller's profile, or an error. Server actions throw on auth
// failure (Next.js server-actions guide pattern) — the /radars page
// and the dashboard strip only call these for allowed roles, so a
// throw here only ever fires on a direct, unauthorized call.
async function requireRadarAccess() {
  const profile = await getUserProfile()
  if (!profile || !profile.organization_id) {
    throw new Error('Unauthorized')
  }
  if (!RADAR_ROLES.includes(profile.role)) {
    throw new Error('Forbidden: Radars are only available to owner, admin and manager roles.')
  }
  return profile
}

// Inventory radar windows
const INVENTORY_RECENT_DAYS = 30
const INVENTORY_WEEK_DAYS = 7

export type MovementType = 'STOCK_IN' | 'STOCK_OUT' | 'WASTAGE' | 'RETURN' | 'ADJUSTMENT'

export interface MovementTypeSummary {
  movement_type: MovementType
  count30d: number
  totalQuantity30d: number
  count7d: number
  totalQuantity7d: number
  /** In/out split of the totals above (M7): "in" is the sum of
   * positive quantities, "out" the absolute sum of negative ones. */
  inQuantity30d: number
  outQuantity30d: number
  inQuantity7d: number
  outQuantity7d: number
}

export interface TopMover {
  product_id: string
  product_name: string
  sku: string | null
  movements: number
  totalQuantity: number
  /** In/out split of totalQuantity (M7): in = units moved in,
   * out = units moved out, both non-negative. */
  inQuantity: number
  outQuantity: number
}

export interface InventoryRadar {
  byType: MovementTypeSummary[]
  topMovers: TopMover[]
  negativeStock: StockRadarProduct[]
}

export interface RadarSummary {
  expiringWithin180Days: number
  urgent30Days: number
  expired: number
  outOfStock: number
  lowStock: number
  pendingPOs: number
  overduePOs: number
}

// Minimal row shapes for the untyped Supabase responses used below.
// (This repo has no generated Database types, so rows are cast at the
// query boundary instead of using `any` through the logic.)
interface ProductRef {
  name: string
  sku?: string | null
}

type JoinedProduct = ProductRef | ProductRef[] | null

interface MovementRow {
  id: string
  movement_type: string
  quantity: number | null
  product_id: string | null
  created_at: string
  products: JoinedProduct
}

export async function getExpiryRadar(): Promise<ExpiryRadar> {
  const profile = await requireRadarAccess()
  // Same source as the dashboard's expiring list (getBatches), but with
  // 4-6 month bands instead of the old 30-day-only cutoff. The radar
  // counts every batch, so it reads up to 5000 rows (the page list
  // caps at 500); past that, counts cover the nearest-expiring
  // 5000 — the page discloses the cap.
  const { rows: allBatches } = await getBatches(profile.organization_id, { limit: 5000 })
  return buildExpiryRadar((allBatches || []) as BatchRow[])
}

export async function getStockRadar(): Promise<StockRadar> {
  // Gate only: the stock RPC derives the org from the caller's
  // own JWT, so no profile value is needed here.
  await requireRadarAccess()
  // Stock now comes from the Postgres aggregate (getStockLevels
  // calls public.get_stock_levels), not a JS sum over history.
  const stockLevels = await getStockLevels()
  return buildStockRadar(stockLevels)
}

export async function getInventoryRadar(
  // A caller that already computed the stock radar (the /radars
  // bundle) passes it in, so stock is computed once per request
  // instead of once here and once for the Stock tab (M8). Pass
  // null explicitly when the stock fetch already failed: the
  // movement tables still render, only the negative-stock anomaly
  // list is skipped instead of re-fetching stock and throwing.
  stockRadar?: StockRadar | null
): Promise<InventoryRadar> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - INVENTORY_RECENT_DAYS)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - INVENTORY_WEEK_DAYS)

  const { data, error } = await supabase
    .from('inventory_movements')
    .select(`
      id,
      movement_type,
      quantity,
      product_id,
      created_at,
      products(name, sku)
    `)
    .eq('organization_id', profile.organization_id)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const movements = (data || []) as MovementRow[]
  const types: MovementType[] = ['STOCK_IN', 'STOCK_OUT', 'WASTAGE', 'RETURN', 'ADJUSTMENT']

  // SIGN CONVENTION (M7), one for the whole tab: quantities are
  // stored signed — STOCK_IN / RETURN positive, STOCK_OUT /
  // WASTAGE negative — and "Total Qty" is the SIGNED net, matching
  // the ledger. "Top Movers" rank by ABSOLUTE units moved (in or
  // out) and split into in/out columns, so a product with heavy
  // two-way traffic is not hidden by a near-zero net.
  const split = (rows: MovementRow[]) => ({
    inQty: rows.reduce((sum, m) => sum + Math.max(0, Number(m.quantity) || 0), 0),
    outQty: rows.reduce((sum, m) => sum + Math.abs(Math.min(0, Number(m.quantity) || 0)), 0),
  })

  const byType: MovementTypeSummary[] = types.map((movement_type) => {
    const inWindow = movements.filter((m) => m.movement_type === movement_type)
    const inWeek = inWindow.filter((m) => new Date(m.created_at) >= sevenDaysAgo)
    const windowSplit = split(inWindow)
    const weekSplit = split(inWeek)
    return {
      movement_type,
      count30d: inWindow.length,
      // Quantities are stored signed (STOCK_OUT / WASTAGE are negative),
      // so totals are signed sums, matching the ledger.
      totalQuantity30d: inWindow.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0),
      count7d: inWeek.length,
      totalQuantity7d: inWeek.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0),
      inQuantity30d: windowSplit.inQty,
      outQuantity30d: windowSplit.outQty,
      inQuantity7d: weekSplit.inQty,
      outQuantity7d: weekSplit.outQty,
    }
  })

  // Top movers by absolute quantity moved in the last 30 days.
  const moverMap = new Map<string, TopMover>()
  movements.forEach((m) => {
    const prod = Array.isArray(m.products) ? m.products[0] : m.products
    const key = m.product_id as string
    if (!key) return
    if (!moverMap.has(key)) {
      moverMap.set(key, {
        product_id: key,
        product_name: prod?.name || 'Unknown Product',
        sku: prod?.sku ?? null,
        movements: 0,
        totalQuantity: 0,
        inQuantity: 0,
        outQuantity: 0,
      })
    }
    const entry = moverMap.get(key)!
    const qty = Number(m.quantity) || 0
    entry.movements += 1
    entry.totalQuantity += Math.abs(qty)
    if (qty >= 0) entry.inQuantity += qty
    else entry.outQuantity += Math.abs(qty)
  })
  const topMovers = Array.from(moverMap.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10)

  // Anomaly: computed stock below zero (same stock method as getStockLevels).
  const resolvedStockRadar = stockRadar === null ? null : (stockRadar ?? (await getStockRadar()))
  const negativeStock = resolvedStockRadar
    ? resolvedStockRadar.products.filter((p) => p.current_stock < 0)
    : []

  return { byType, topMovers, negativeStock }
}

export async function getVendorsRadar(): Promise<VendorsRadar> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  const [
    { data: vendors, error: vendorError },
    { data: pos, error: poError },
    poItems,
  ] = await Promise.all([
    supabase
      .from('vendors')
      .select('id, name, contact_person, phone, email, is_active')
      .eq('organization_id', profile.organization_id)
      .order('name', { ascending: true }),
    supabase
      .from('purchase_orders')
      .select('id, vendor_id, status, created_at, total_amount')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),
    getPurchaseOrderItems(supabase, profile.organization_id),
  ])

  if (vendorError) throw new Error(vendorError.message)
  if (poError) throw new Error(poError.message)

  return buildVendorsRadar(
    (vendors || []) as VendorRow[],
    (pos || []) as PurchaseOrderRow[],
    poItems
  )
}

// PO lines for the vendors payable math (M6). purchase_order_items
// has no organization_id of its own, so it is scoped through its
// parent PO (inner join, same pattern as the sale_items queries).
async function getPurchaseOrderItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<PurchaseOrderItemRow[]> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('po_id, quantity, unit_price, received_quantity, purchase_orders!inner(organization_id)')
    .eq('purchase_orders.organization_id', orgId)

  if (error) throw new Error(error.message)
  return (data || []) as PurchaseOrderItemRow[]
}

// Empty radar results: the per-radar fallback when one leg of a
// summary fails (M4) — the strip shows zeros for that radar
// instead of taking the whole dashboard down with it.
const EMPTY_EXPIRY_RADAR: ExpiryRadar = {
  counts: { EXPIRED: 0, URGENT: 0, WARNING_4M: 0, WATCH_6M: 0, HEALTHY: 0 },
  expiringWithin180Days: 0,
  totalBatchesWithStock: 0,
  batches: [],
}

const EMPTY_STOCK_RADAR: StockRadar = {
  counts: { OUT_OF_STOCK: 0, LOW: 0, HEALTHY: 0 },
  products: [],
}

const EMPTY_VENDORS_RADAR: VendorsRadar = {
  totalVendors: 0,
  activeVendors: 0,
  totalPendingPOs: 0,
  vendorsWithOverdue: 0,
  totalOutstandingPayable: 0,
  unknownStatusPOs: 0,
  vendors: [],
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Failed to load.'
}

export interface RadarsBundle {
  expiry: ExpiryRadar | null
  expiryError: string | null
  stock: StockRadar | null
  stockError: string | null
  inventory: InventoryRadar | null
  inventoryError: string | null
  vendors: VendorsRadar | null
  vendorsError: string | null
}

export async function getRadarsBundle(): Promise<RadarsBundle> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  // One radar failing must not kill the other three (M4): every
  // leg settles on its own, and the page renders an error state
  // with retry for the failed tab only. Only the auth gate above
  // still throws (an unauthorized caller gets no radar at all).
  const [batchesRes, stockRes, vendorsRes, posRes, poItemsRes] =
    await Promise.allSettled([
      getBatches(profile.organization_id, { limit: 5000 }),
      getStockLevels(),
      supabase
        .from('vendors')
        .select('id, name, contact_person, phone, email, is_active')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true }),
      supabase
        .from('purchase_orders')
        .select('id, vendor_id, status, created_at, total_amount')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }),
      getPurchaseOrderItems(supabase, profile.organization_id),
    ])

  let expiry: ExpiryRadar | null = null
  let expiryError: string | null = null
  if (batchesRes.status === 'fulfilled') {
    expiry = buildExpiryRadar((batchesRes.value.rows || []) as BatchRow[])
  } else {
    expiryError = errorMessage(batchesRes.reason)
  }

  let stock: StockRadar | null = null
  let stockError: string | null = null
  if (stockRes.status === 'fulfilled') {
    stock = buildStockRadar(stockRes.value)
  } else {
    stockError = errorMessage(stockRes.reason)
  }

  let vendors: VendorsRadar | null = null
  let vendorsError: string | null = null
  if (
    vendorsRes.status === 'fulfilled' &&
    posRes.status === 'fulfilled' &&
    poItemsRes.status === 'fulfilled'
  ) {
    if (vendorsRes.value.error) vendorsError = vendorsRes.value.error.message
    else if (posRes.value.error) vendorsError = posRes.value.error.message
    else {
      vendors = buildVendorsRadar(
        (vendorsRes.value.data || []) as VendorRow[],
        (posRes.value.data || []) as PurchaseOrderRow[],
        poItemsRes.value
      )
    }
  } else {
    const failed = [vendorsRes, posRes, poItemsRes].find((r) => r.status === 'rejected')
    vendorsError =
      failed && failed.status === 'rejected'
        ? errorMessage(failed.reason)
        : 'Failed to load vendors.'
  }

  // Inventory reuses the stock radar computed above (its only
  // stock use is the negative-stock list) instead of fetching
  // stock a second time. A null stock radar means "skip the
  // anomaly list", not "fail the tab".
  let inventory: InventoryRadar | null = null
  let inventoryError: string | null = null
  try {
    inventory = await getInventoryRadar(stock)
  } catch (err) {
    inventoryError = errorMessage(err)
  }

  return { expiry, expiryError, stock, stockError, inventory, inventoryError, vendors, vendorsError }
}

// Compact numbers for the alert strip on /dashboard. Reuses the three
// radar actions so the strip can never disagree with the /radars page.
// Each delegated action requires the caller's profile and org scope,
// so the summary is gated and scoped the same way.
//
// Callers that already hold stock levels / batches (the dashboard,
// which fetched both for its own cards) pass them in, so the
// summary does not fetch the same datasets a second time (M8).
//
// One radar failing must not kill the strip (M4): the legs settle
// independently with per-radar fallbacks (empty counts), so a
// failed vendors query, say, still leaves the expiry numbers up.
export async function getRadarSummary(precomputed?: {
  stockLevels?: StockLevelRow[]
  batches?: BatchRow[]
}): Promise<RadarSummary> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  const [stockRes, batchesRes, vendorsRes, posRes, poItemsRes] =
    await Promise.allSettled([
      precomputed?.stockLevels
        ? Promise.resolve(precomputed.stockLevels)
        : getStockLevels(),
      precomputed?.batches
        ? Promise.resolve({ rows: precomputed.batches })
        : getBatches(profile.organization_id, { limit: 5000 }),
      supabase
        .from('vendors')
        .select('id, name, contact_person, phone, email, is_active')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true }),
      supabase
        .from('purchase_orders')
        .select('id, vendor_id, status, created_at, total_amount')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }),
      getPurchaseOrderItems(supabase, profile.organization_id),
    ])

  const stock =
    stockRes.status === 'fulfilled' ? buildStockRadar(stockRes.value) : EMPTY_STOCK_RADAR
  const expiry =
    batchesRes.status === 'fulfilled'
      ? buildExpiryRadar((batchesRes.value.rows || []) as BatchRow[])
      : EMPTY_EXPIRY_RADAR
  const vendorsRadar =
    vendorsRes.status === 'fulfilled' &&
    posRes.status === 'fulfilled' &&
    poItemsRes.status === 'fulfilled' &&
    !vendorsRes.value.error &&
    !posRes.value.error
      ? buildVendorsRadar(
          (vendorsRes.value.data || []) as VendorRow[],
          (posRes.value.data || []) as PurchaseOrderRow[],
          poItemsRes.value
        )
      : EMPTY_VENDORS_RADAR

  return {
    expiringWithin180Days: expiry.expiringWithin180Days,
    urgent30Days: expiry.counts.URGENT + expiry.counts.EXPIRED,
    expired: expiry.counts.EXPIRED,
    outOfStock: stock.counts.OUT_OF_STOCK,
    lowStock: stock.counts.LOW,
    pendingPOs: vendorsRadar.totalPendingPOs,
    overduePOs: vendorsRadar.vendors.reduce((sum, v) => sum + v.overdue_pos, 0),
  }
}
