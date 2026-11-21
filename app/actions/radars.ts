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
}

export interface TopMover {
  product_id: string
  product_name: string
  sku: string | null
  movements: number
  totalQuantity: number
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
  // instead of once here and once for the Stock tab (M8).
  stockRadar?: StockRadar
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

  const byType: MovementTypeSummary[] = types.map((movement_type) => {
    const inWindow = movements.filter((m) => m.movement_type === movement_type)
    const inWeek = inWindow.filter((m) => new Date(m.created_at) >= sevenDaysAgo)
    return {
      movement_type,
      count30d: inWindow.length,
      // Quantities are stored signed (STOCK_OUT / WASTAGE are negative),
      // so totals are signed sums, matching the ledger.
      totalQuantity30d: inWindow.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0),
      count7d: inWeek.length,
      totalQuantity7d: inWeek.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0),
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
      })
    }
    const entry = moverMap.get(key)!
    entry.movements += 1
    entry.totalQuantity += Math.abs(Number(m.quantity) || 0)
  })
  const topMovers = Array.from(moverMap.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10)

  // Anomaly: computed stock below zero (same stock method as getStockLevels).
  const resolvedStockRadar = stockRadar ?? (await getStockRadar())
  const negativeStock = resolvedStockRadar.products.filter((p) => p.current_stock < 0)

  return { byType, topMovers, negativeStock }
}

export async function getVendorsRadar(): Promise<VendorsRadar> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  const [{ data: vendors, error: vendorError }, { data: pos, error: poError }] =
    await Promise.all([
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
    ])

  if (vendorError) throw new Error(vendorError.message)
  if (poError) throw new Error(poError.message)

  return buildVendorsRadar(
    (vendors || []) as VendorRow[],
    (pos || []) as PurchaseOrderRow[]
  )
}

export interface RadarsBundle {
  expiry: ExpiryRadar
  stock: StockRadar
  inventory: InventoryRadar
  vendors: VendorsRadar
}

export async function getRadarsBundle(): Promise<RadarsBundle> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  const [
    { rows: allBatches },
    stockLevels,
    { data: vendors, error: vendorError },
    { data: pos, error: poError },
  ] = await Promise.all([
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
  ])

  if (vendorError) throw new Error(vendorError.message)
  if (poError) throw new Error(poError.message)

  const expiry = buildExpiryRadar((allBatches || []) as BatchRow[])
  const stock = buildStockRadar(stockLevels)
  // Inventory reuses the stock radar computed above (its only
  // stock use is the negative-stock list) instead of fetching
  // stock a second time.
  const inventory = await getInventoryRadar(stock)
  const vendorsRadar = buildVendorsRadar(
    (vendors || []) as VendorRow[],
    (pos || []) as PurchaseOrderRow[]
  )

  return { expiry, stock, inventory, vendors: vendorsRadar }
}

// Compact numbers for the alert strip on /dashboard. Reuses the three
// radar actions so the strip can never disagree with the /radars page.
// Each delegated action requires the caller's profile and org scope,
// so the summary is gated and scoped the same way.
//
// Callers that already hold stock levels / batches (the dashboard,
// which fetched both for its own cards) pass them in, so the
// summary does not fetch the same datasets a second time (M8).
export async function getRadarSummary(precomputed?: {
  stockLevels?: StockLevelRow[]
  batches?: BatchRow[]
}): Promise<RadarSummary> {
  const profile = await requireRadarAccess()
  const supabase = await createClient()

  const stockLevels = precomputed?.stockLevels ?? (await getStockLevels())
  const stock = buildStockRadar(stockLevels)

  const [{ rows: allBatches }, { data: vendors, error: vendorError }, { data: pos, error: poError }] =
    await Promise.all([
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
    ])

  if (vendorError) throw new Error(vendorError.message)
  if (poError) throw new Error(poError.message)

  const expiry = buildExpiryRadar((allBatches || []) as BatchRow[])
  const vendorsRadar = buildVendorsRadar(
    (vendors || []) as VendorRow[],
    (pos || []) as PurchaseOrderRow[]
  )

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
