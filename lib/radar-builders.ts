// Pure radar builders (no 'use server' here on purpose).
//
// These used to live in app/actions/radars.ts, but a 'use server'
// file may only export async functions — the Next.js build
// rejects sync exports from it. The builders are pure functions
// over already-fetched rows (compute once, share between the
// /radars tabs and the dashboard strip), so they belong in lib.
// The server actions in app/actions/radars.ts stay thin wrappers
// that fetch + call these.
//
// Days-left and "urgent" come from lib/dates.ts (QA audit M5):
// the strip and the dashboard KPI used to compute them differently
// and disagree by a day near midnight. There is one definition
// now — daysUntil() + isUrgentExpiry() — and every consumer here
// and in dashboard.ts uses it.
import { daysUntil, isUrgentExpiry } from './dates'

// Expiry bands (days left until expiry_date, counted from start of today)
const EXPIRY_WARNING_DAYS = 120 // 4 months
const EXPIRY_WATCH_DAYS = 180 // 6 months

// Fallback low-stock level, used only when a product has no
// minimum_stock_level set — including a stored 0, which is what
// createProduct / updateProduct store when unset (QA audit M3).
// The schema default is 0, so "0 means unset" is the only rule
// under which the LOW band can ever fire.
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
  /** Batches with stock left, any band (incl. HEALTHY and no-expiry)
   * — so the empty state can tell "no batches at all" apart from
   * "batches exist, none expiring within 180 days" (QA audit L8). */
  totalBatchesWithStock: number
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
  /** Value of goods ordered from this vendor but not yet received
   * (QA audit M6): for each pending PO, the unreceived share of
   * its lines (qty − received_qty) × unit_price, or the PO total
   * when the PO has no lines. Received / cancelled POs owe 0. */
  outstandingPayable: number
}

export interface VendorsRadar {
  totalVendors: number
  activeVendors: number
  totalPendingPOs: number
  vendorsWithOverdue: number
  /** Sum of outstandingPayable across vendors (same definition). */
  totalOutstandingPayable: number
  /** POs whose status is in none of the known sets below: they are
   * counted as pending (fail-visible) and surfaced in the UI
   * instead of silently assuming a meaning (QA audit L8). */
  unknownStatusPOs: number
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

export interface PurchaseOrderItemRow {
  po_id: string
  quantity: number | null
  unit_price: number | null
  received_quantity: number | null
}

// PO status vocabulary (QA audit L8). Only 'sent' and 'received'
// exist in the app today (create → 'sent', receive → 'received');
// 'pending' / 'ordered' / 'draft' are accepted as pending so a
// future status, or one set directly in the DB, is not
// misclassified. 'cancelled' is terminal even though no cancel
// flow exists in the UI yet — a PO cancelled directly in the DB
// must not count as pending or payable. Anything else is unknown:
// counted as pending (fail-visible) and reported separately.
const PENDING_PO_STATUSES = ['sent', 'pending', 'ordered', 'draft']
const TERMINAL_PO_STATUSES = ['received', 'cancelled']

function expiryBand(daysLeft: number): ExpiryBand {
  if (daysLeft < 0) return 'EXPIRED'
  if (isUrgentExpiry(daysLeft)) return 'URGENT'
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
  const batchesWithStock = ((allBatches || []) as BatchRow[]).filter(
    (b) => Number(b.quantity_remaining) > 0
  )
  const batches: ExpiryRadarBatch[] = batchesWithStock
    .filter((b): b is BatchRow & { expiry_date: string } => Boolean(b.expiry_date))
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
    totalBatchesWithStock: batchesWithStock.length,
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
    // A stored 0 counts as unset (QA audit M3): createProduct stores
    // 0 when no minimum is given, and the schema default is 0 — so
    // the 10 fallback applies to null, undefined AND 0. Without this
    // the LOW band could never fire (threshold 0 is already out of
    // stock). The returned minimum_stock_level is the EFFECTIVE
    // threshold, so the UI shows 10 for an unset minimum.
    const rawMin = p.minimum_stock_level
    const threshold =
      rawMin === null || rawMin === undefined || Number(rawMin) === 0
        ? LOW_STOCK_THRESHOLD
        : Number(rawMin)
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
// "Overdue" is PO age only — purchase_orders has no due date —
// and the payable math below is the value of goods ordered but
// not yet received (M6), not a due-date aging.
export function buildVendorsRadar(
  vendors: VendorRow[],
  pos: PurchaseOrderRow[],
  poItems: PurchaseOrderItemRow[] = []
): VendorsRadar {
  const now = new Date()
  const overdueCutoff = new Date(now)
  overdueCutoff.setDate(overdueCutoff.getDate() - OVERDUE_PO_DAYS)

  // A PO is pending while its status is an open one. Unknown
  // statuses count as pending too (fail-visible) and are reported
  // separately instead of being silently assumed.
  const isTerminal = (status: string) => TERMINAL_PO_STATUSES.includes(status)
  const isPending = (status: string) => !isTerminal(status)
  const isUnknownStatus = (status: string) =>
    !PENDING_PO_STATUSES.includes(status) && !TERMINAL_PO_STATUSES.includes(status)

  // Outstanding amount of one PO: the unreceived share of its
  // lines. A PO with no lines falls back to its header total.
  const outstandingOf = (po: PurchaseOrderRow): number => {
    if (isTerminal(po.status)) return 0
    const lines = poItems.filter((it) => it.po_id === po.id)
    if (lines.length === 0) return Number(po.total_amount) || 0
    return lines.reduce((sum, it) => {
      const unreceived = Math.max(
        0,
        (Number(it.quantity) || 0) - (Number(it.received_quantity) || 0)
      )
      return sum + unreceived * (Number(it.unit_price) || 0)
    }, 0)
  }

  const unknownStatusPOs = ((pos || []) as PurchaseOrderRow[]).filter((po) =>
    isUnknownStatus(po.status)
  ).length

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
      outstandingPayable: pendingPOs.reduce((sum, po) => sum + outstandingOf(po), 0),
    }
  })

  // Vendors with overdue POs first, then most pending POs.
  vendorList.sort((a, b) => Number(b.has_overdue) - Number(a.has_overdue) || b.pending_pos - a.pending_pos)

  return {
    totalVendors: vendorList.length,
    activeVendors: vendorList.filter((v) => v.is_active).length,
    totalPendingPOs: vendorList.reduce((sum, v) => sum + v.pending_pos, 0),
    vendorsWithOverdue: vendorList.filter((v) => v.has_overdue).length,
    totalOutstandingPayable: vendorList.reduce((sum, v) => sum + v.outstandingPayable, 0),
    unknownStatusPOs,
    vendors: vendorList,
  }
}

// All four radars in one request (M8): batches and stock are
// fetched ONCE and shared — the old page loaded getStockRadar
// directly and again inside getInventoryRadar, so stock was
// computed twice per /radars visit. The dashboard uses
// getRadarSummary (below) with its own precomputed stock and
// batches instead of this bundle.
