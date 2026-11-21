'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile, type UserRole } from '@/lib/auth-utils'
import { getStockLevels, getBatches } from '@/app/actions/inventory'

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

// Expiry bands (days left until expiry_date, counted from start of today)
const EXPIRY_URGENT_DAYS = 30
const EXPIRY_WARNING_DAYS = 120 // 4 months
const EXPIRY_WATCH_DAYS = 180 // 6 months

// Fallback low-stock level, used only when a product has no
// minimum_stock_level set. products.minimum_stock_level exists in the
// schema (see createProduct / getStockLevels in inventory.ts).
const LOW_STOCK_THRESHOLD = 10

// A pending purchase order older than this is flagged overdue.
const OVERDUE_PO_DAYS = 30

// Inventory radar windows
const INVENTORY_RECENT_DAYS = 30
const INVENTORY_WEEK_DAYS = 7

export type ExpiryBand = 'EXPIRED' | 'URGENT' | 'WARNING_4M' | 'WATCH_6M' | 'HEALTHY'

export interface ExpiryRadarBatch {
  id: string
  product_name: string
  batch_number: string
  quantity_remaining: number
  expiry_date: string
  days_left: number
  band: ExpiryBand
}

export interface ExpiryRadar {
  counts: Record<ExpiryBand, number>
  expiringWithin180Days: number
  batches: ExpiryRadarBatch[]
}

export type StockStatus = 'OUT_OF_STOCK' | 'LOW' | 'HEALTHY'

export interface StockRadarProduct {
  id: string
  name: string
  sku: string | null
  current_stock: number
  minimum_stock_level: number
  status: StockStatus
}

export interface StockRadar {
  counts: Record<StockStatus, number>
  products: StockRadarProduct[]
}

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

export interface VendorRadarVendor {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  total_pos: number
  pending_pos: number
  overdue_pos: number
  last_order_date: string | null
  has_overdue: boolean
}

export interface VendorsRadar {
  totalVendors: number
  activeVendors: number
  totalPendingPOs: number
  vendorsWithOverdue: number
  vendors: VendorRadarVendor[]
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

interface BatchRow {
  id: string
  batch_number: string
  quantity_remaining: number | null
  expiry_date: string | null
  products: JoinedProduct
}

interface MovementRow {
  id: string
  movement_type: string
  quantity: number | null
  product_id: string | null
  created_at: string
  products: JoinedProduct
}

interface VendorRow {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  is_active: boolean | null
}

interface PurchaseOrderRow {
  id: string
  vendor_id: string | null
  status: string
  created_at: string | null
  total_amount: number | null
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function expiryBand(daysLeft: number): ExpiryBand {
  if (daysLeft < 0) return 'EXPIRED'
  if (daysLeft < EXPIRY_URGENT_DAYS) return 'URGENT'
  if (daysLeft < EXPIRY_WARNING_DAYS) return 'WARNING_4M'
  if (daysLeft <= EXPIRY_WATCH_DAYS) return 'WATCH_6M'
  return 'HEALTHY'
}

export async function getExpiryRadar(): Promise<ExpiryRadar> {
  const profile = await requireRadarAccess()
  // Same source as the dashboard's expiring list (getBatches), but with
  // 4-6 month bands instead of the old 30-day-only cutoff.
  const allBatches = await getBatches(profile.organization_id)

  const counts: Record<ExpiryBand, number> = {
    EXPIRED: 0,
    URGENT: 0,
    WARNING_4M: 0,
    WATCH_6M: 0,
    HEALTHY: 0,
  }

  // Only batches with stock left can expire on the shelf; fully consumed
  // batches (quantity_remaining <= 0) are excluded, as in dashboard.ts.
  const batches: ExpiryRadarBatch[] = ((allBatches || []) as BatchRow[])
    .filter((b): b is BatchRow & { expiry_date: string } => Boolean(b.expiry_date) && Number(b.quantity_remaining) > 0)
    .map((b) => {
      const daysLeft = daysUntil(b.expiry_date)
      const band = expiryBand(daysLeft)
      counts[band] += 1
      const prodName = Array.isArray(b.products) ? b.products[0]?.name : b.products?.name
      return {
        id: b.id,
        product_name: prodName || 'Unknown Product',
        batch_number: b.batch_number,
        quantity_remaining: Number(b.quantity_remaining) || 0,
        expiry_date: b.expiry_date,
        days_left: daysLeft,
        band,
      }
    })
    // Most urgent first: expired / nearest expiry at the top.
    .sort((a, b) => a.days_left - b.days_left)

  return {
    counts,
    expiringWithin180Days:
      counts.EXPIRED + counts.URGENT + counts.WARNING_4M + counts.WATCH_6M,
    batches,
  }
}

export async function getStockRadar(): Promise<StockRadar> {
  const profile = await requireRadarAccess()
  // Same method as getStockLevels in inventory.ts: current stock is the
  // sum of inventory_movements.quantity per product.
  const stockLevels = await getStockLevels(profile.organization_id)

  const counts: Record<StockStatus, number> = {
    OUT_OF_STOCK: 0,
    LOW: 0,
    HEALTHY: 0,
  }

  const products: StockRadarProduct[] = (stockLevels || []).map((p) => {
    const currentStock = Number(p.current_stock) || 0
    // products.minimum_stock_level exists; fall back to the constant only
    // when it is null / undefined.
    const threshold =
      p.minimum_stock_level === null || p.minimum_stock_level === undefined
        ? LOW_STOCK_THRESHOLD
        : Number(p.minimum_stock_level) || 0
    const status: StockStatus =
      currentStock <= 0 ? 'OUT_OF_STOCK' : currentStock <= threshold ? 'LOW' : 'HEALTHY'
    counts[status] += 1
    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      current_stock: currentStock,
      minimum_stock_level: threshold,
      status,
    }
  })

  // Out of stock first, then low, then healthy; most depleted first.
  const order: Record<StockStatus, number> = { OUT_OF_STOCK: 0, LOW: 1, HEALTHY: 2 }
  products.sort((a, b) => order[a.status] - order[b.status] || a.current_stock - b.current_stock)

  return { counts, products }
}

export async function getInventoryRadar(): Promise<InventoryRadar> {
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
  const stockRadar = await getStockRadar()
  const negativeStock = stockRadar.products.filter((p) => p.current_stock < 0)

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

  const now = new Date()
  const overdueCutoff = new Date(now)
  overdueCutoff.setDate(overdueCutoff.getDate() - OVERDUE_PO_DAYS)

  // A PO is pending / unreceived while its status is anything other than
  // 'received' (sent / ordered / draft / pending) and not 'cancelled'.
  const isPending = (status: string) => status !== 'received' && status !== 'cancelled'

  const vendorList: VendorRadarVendor[] = ((vendors || []) as VendorRow[]).map((v) => {
    const vendorPOs = ((pos || []) as PurchaseOrderRow[]).filter((po) => po.vendor_id === v.id)
    const pendingPOs = vendorPOs.filter((po) => isPending(po.status))
    const overduePOs = pendingPOs.filter(
      (po) => po.created_at && new Date(po.created_at) < overdueCutoff
    )
    return {
      id: v.id,
      name: v.name,
      contact_person: v.contact_person ?? null,
      phone: v.phone ?? null,
      email: v.email ?? null,
      is_active: v.is_active !== false,
      total_pos: vendorPOs.length,
      pending_pos: pendingPOs.length,
      overdue_pos: overduePOs.length,
      last_order_date: vendorPOs[0]?.created_at ?? null,
      has_overdue: overduePOs.length > 0,
    }
  })

  // Vendors with overdue POs first, then most pending POs.
  vendorList.sort((a, b) => Number(b.has_overdue) - Number(a.has_overdue) || b.pending_pos - a.pending_pos)

  return {
    totalVendors: vendorList.length,
    activeVendors: vendorList.filter((v) => v.is_active).length,
    totalPendingPOs: vendorList.reduce((sum, v) => sum + v.pending_pos, 0),
    vendorsWithOverdue: vendorList.filter((v) => v.has_overdue).length,
    vendors: vendorList,
  }
}

// Compact numbers for the alert strip on /dashboard. Reuses the three
// radar actions so the strip can never disagree with the /radars page.
// Each delegated action requires the caller's profile and org scope,
// so the summary is gated and scoped the same way.
export async function getRadarSummary(): Promise<RadarSummary> {
  const [expiry, stock, vendors] = await Promise.all([
    getExpiryRadar(),
    getStockRadar(),
    getVendorsRadar(),
  ])

  return {
    expiringWithin180Days: expiry.expiringWithin180Days,
    urgent30Days: expiry.counts.URGENT + expiry.counts.EXPIRED,
    expired: expiry.counts.EXPIRED,
    outOfStock: stock.counts.OUT_OF_STOCK,
    lowStock: stock.counts.LOW,
    pendingPOs: vendors.totalPendingPOs,
    overduePOs: vendors.vendors.reduce((sum, v) => sum + v.overdue_pos, 0),
  }
}
