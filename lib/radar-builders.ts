// Pure radar builders (no 'use server' here on purpose).
//
// These used to live in app/actions/radars.ts, but a 'use server'
// file may only export async functions — the Next.js build
// rejects sync exports from it. The builders are pure functions
// over already-fetched rows (compute once, share between the
// /radars tabs and the dashboard strip), so they belong in lib.
// The server actions in app/actions/radars.ts stay thin wrappers
// that fetch + call these.

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

// Minimal row shapes for the untyped Supabase responses used below.
// (This repo has no generated Database types, so rows are cast at the
// query boundary instead of using `any` through the logic.)
interface ProductRef {
  name: string
  sku?: string | null
}

type JoinedProduct = ProductRef | ProductRef[] | null

export interface BatchRow {
  id: string
  batch_number: string
  quantity_remaining: number | null
  expiry_date: string | null
  products: JoinedProduct
}

export interface VendorRow {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  is_active: boolean | null
}

export interface PurchaseOrderRow {
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

// Pure builder: expiry bands from an already-fetched batch list,
// so callers that already hold the batches (the /radars bundle,
// the dashboard) do not fetch them a second time.
export function buildExpiryRadar(allBatches: BatchRow[]): ExpiryRadar {
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

// Stock levels the RPC returns — the input shape of the builder
// below (a caller that already fetched stock passes it through
// instead of fetching it again).
export interface StockLevelRow {
  id: string
  name: string
  sku: string | null
  minimum_stock_level: number | null
  current_stock: number
}

// Pure builder: stock bands from an already-fetched stock list.
export function buildStockRadar(stockLevels: StockLevelRow[]): StockRadar {
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

// Pure builder: vendor PO-age rollup from already-fetched rows.
export function buildVendorsRadar(
  vendors: VendorRow[],
  pos: PurchaseOrderRow[]
): VendorsRadar {
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

// All four radars in one request (M8): batches and stock are
// fetched ONCE and shared — the old page loaded getStockRadar
// directly and again inside getInventoryRadar, so stock was
// computed twice per /radars visit. The dashboard uses
// getRadarSummary (below) with its own precomputed stock and
// batches instead of this bundle.
