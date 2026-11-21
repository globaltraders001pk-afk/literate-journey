'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth-utils'
import { getStockLevels, getBatches } from '@/app/actions/inventory'
import { getTasks } from '@/app/actions/tasks'
import {
  buildExpiryRadar,
  buildStockRadar,
  buildVendorsRadar,
  type BatchRow,
  type PurchaseOrderRow,
  type StockLevelRow,
  type VendorRow,
} from '@/lib/radar-builders'
import { daysUntil, isUrgentExpiry, todayPKT, toPKTDateString } from '@/lib/dates'
import type { RadarSummary } from '@/app/actions/radars'

export async function getCheeseCommandCenterData() {
  const [profile, supabase] = await Promise.all([
    getUserProfile(),
    createClient()
  ])

  // Org scope for every query below (QA audit H2). The dashboard
  // layout redirects unauthenticated users, so a missing profile
  // is unreachable in practice; the nil UUID matches nothing and
  // keeps the function fail-closed instead of leaking all tenants.
  const orgId = profile?.organization_id ?? '00000000-0000-0000-0000-000000000000'

  const date = new Date()
  // Month / day boundaries are the business's calendar (Asia/Karachi),
  // not UTC: a sale at 00:30 PKT belongs to the PKT date, and the
  // UTC instant is the previous day (QA audit M9).
  const todayStr = todayPKT()
  const month = Number(todayStr.split('-')[1])
  const year = Number(todayStr.split('-')[0])

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const sevenDaysAgo = new Date(date)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  // Execute all independent database queries concurrently in parallel
  const [
    allStock,
    allBatches,
    categoriesCountRes,
    productsCountRes,
    monthSalesRes,
    prevSalesRes,
    weekSalesRes,
    recentSalesRes,
    saleItemsRes,
    allTasks,
    vendorsRes,
    posRes
  ] = await Promise.all([
    getStockLevels(),
    getBatches(),
    supabase.from('categories').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase
      .from('sales')
      .select('total_amount, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('created_at', month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`),
    supabase
      .from('sales')
      .select('total_amount')
      .eq('organization_id', orgId)
      .gte('created_at', `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`)
      .lt('created_at', `${year}-${month.toString().padStart(2, '0')}-01`),
    supabase
      .from('sales')
      .select('total_amount, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('sales')
      .select(`
        id,
        invoice_number,
        total_amount,
        payment_method,
        created_at,
        customers (name),
        sale_items (quantity, products (name))
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(6),
    // sale_items has no organization_id column of its own, so it is
    // scoped through its parent sale (inner join: rows whose sale
    // is in another org never reach the client). The query is capped
    // at 300 rows — topProductsTruncated below says so instead of
    // silently ranking a partial history (QA audit M11).
    supabase
      .from('sale_items')
      .select('quantity, subtotal, products (id, name, sku), sales!inner(organization_id)', { count: 'exact' })
      .eq('sales.organization_id', orgId)
      .order('id', { ascending: false })
      .limit(300),
    getTasks(),
    // Vendors + POs for the radar summary, fetched here so the
    // dashboard does not load them a second time via
    // getRadarSummary (M8: stock + batches were loaded twice per
    // dashboard visit — once here, once inside the summary).
    supabase
      .from('vendors')
      .select('id, name, contact_person, phone, email, is_active')
      .eq('organization_id', orgId)
      .order('name', { ascending: true }),
    supabase
      .from('purchase_orders')
      .select('id, vendor_id, status, created_at, total_amount')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
  ])

  // 1. Calculate Monthly & Today's Sales
  const monthSales = monthSalesRes.data || []
  const currentMonthSales = monthSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
  const currentMonthOrders = monthSales.length

  const prevSales = prevSalesRes.data || []
  const lastMonthSales = prevSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)
  // No last month to grow from: null, not a forced 100% (QA audit
  // L7/M11). The client renders "— vs last mo." for null.
  const salesGrowth = lastMonthSales === 0 ? null : ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100

  const todaySales = monthSales.filter(s => toPKTDateString(s.created_at) === todayStr)
  const todaySalesTotal = todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const todaySalesCount = todaySales.length

  // 2. 7-Day Trend
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const trendMap = new Map<string, { day: string; date: string; amount: number; count: number }>()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(date)
    d.setDate(d.getDate() - i)
    const key = toPKTDateString(d)
    // Weekday of the PKT calendar day, not the server-local one.
    const [ky, km, kd] = key.split('-').map(Number)
    trendMap.set(key, {
      day: dayNames[new Date(Date.UTC(ky, km - 1, kd)).getUTCDay()],
      date: key,
      amount: 0,
      count: 0
    })
  }

  const weekSales = weekSalesRes.data || []
  weekSales.forEach((s: any) => {
    const key = toPKTDateString(s.created_at)
    if (trendMap.has(key)) {
      const item = trendMap.get(key)!
      item.amount += Number(s.total_amount) || 0
      item.count++
    }
  })

  const dailyTrend = Array.from(trendMap.values())

  // 3. Recent Sales Transactions
  const recentSales = (recentSalesRes.data || []).map((s: any) => {
    const customerName = Array.isArray(s.customers) ? s.customers[0]?.name : s.customers?.name
    const itemsCount = s.sale_items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0
    const primaryItem = s.sale_items?.[0]?.products?.name || 'Selected Item'
    return {
      id: s.id,
      invoice_number: s.invoice_number,
      total_amount: Number(s.total_amount) || 0,
      payment_method: s.payment_method || 'CASH',
      created_at: s.created_at,
      customer_name: customerName || 'Walk-in Customer',
      items_count: itemsCount,
      summary: s.sale_items && s.sale_items.length > 1 ? `${primaryItem} +${s.sale_items.length - 1} more` : primaryItem
    }
  })

  // 4. Top Selling Products — revenue is EX-GST line subtotals
  // (item 4): the same basis the Reports ranking uses, labelled in
  // the UI. Sales totals elsewhere are incl-GST grand totals.
  const saleItems = saleItemsRes.data || []
  const productMap = new Map<string, { id: string; name: string; sku: string; quantity: number; revenue: number }>()
  saleItems.forEach((item: any) => {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products
    if (!prod) return
    const id = prod.id
    if (!productMap.has(id)) {
      productMap.set(id, { id, name: prod.name, sku: prod.sku || '', quantity: 0, revenue: 0 })
    }
    const p = productMap.get(id)!
    p.quantity += item.quantity || 0
    p.revenue += Number(item.subtotal) || 0
  })

  const topCheeses = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 4)

  // 5. Stock Levels & Low Stock Alerts — derived from the same
  // buildStockRadar() the radars use (single compute, M8), NOT
  // from the RPC's status string: the RPC only ever returned
  // 'Low Stock' / 'In Stock', so the dashboard's 'Out of Stock'
  // branch could never fire (QA audit L7). The minimum shown is
  // the builder's EFFECTIVE threshold (10 when unset, 0 = unset)
  // — never `|| 5`, which printed a made-up "min 5".
  const stockList = allStock || []
  const stock = buildStockRadar((stockList || []) as StockLevelRow[])
  const lowStockItems = stock.products
    .filter((p) => p.status === 'LOW' || p.status === 'OUT_OF_STOCK')
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      current_stock: p.current_stock,
      minimum_stock_level: p.minimum_stock_level,
      status: p.status === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'
    }))

  const lowStockCount = stock.counts.OUT_OF_STOCK + stock.counts.LOW

  // 6. Batches & Expiring Alerts (computed from single allBatches query)
  // Batches arrive ordered by expiry first, so the 500-row page
  // still holds the nearest-expiring batches.
  // "Expiring within 30 days" is the ONE shared definition (M5):
  // daysUntil() from lib/dates.ts, urgent = fewer than 30 days
  // left (expired included, day 30 excluded) — the same count the
  // radar strip shows as "urgent · 30 days".
  const batchList = allBatches.rows || []
  const expiringBatchesList = batchList
    .filter((b: any) => {
      if (!b.expiry_date || b.quantity_remaining <= 0) return false
      return isUrgentExpiry(daysUntil(b.expiry_date))
    })

  const expiringBatches = expiringBatchesList
    .slice(0, 5)
    .map((b: any) => {
      const diffDays = daysUntil(b.expiry_date)
      const prodName = Array.isArray(b.products) ? b.products[0]?.name : b.products?.name
      return {
        id: b.id,
        batch_number: b.batch_number,
        product_name: prodName || 'Batch Item',
        quantity_remaining: b.quantity_remaining,
        expiry_date: b.expiry_date,
        days_left: diffDays
      }
    })

  // 7. Active Tasks
  const taskList = allTasks.rows || []
  const activeTasks = taskList
    .filter((t: any) => t.status !== 'DONE')
    .slice(0, 5)

  // Radar summary from the stock + batches already fetched above
  // (M8): the dashboard used to call getRadarSummary() afterwards,
  // which re-fetched both datasets. Employees get no summary.
  const role = profile?.role || 'employee'
  let radarSummary: RadarSummary | null = null
  if (role !== 'employee') {
    const expiry = buildExpiryRadar((batchList || []) as BatchRow[])
    const vendorsRadar = buildVendorsRadar(
      ((vendorsRes.data || []) as VendorRow[]),
      ((posRes.data || []) as PurchaseOrderRow[])
    )
    radarSummary = {
      expiringWithin180Days: expiry.expiringWithin180Days,
      urgent30Days: expiry.counts.URGENT + expiry.counts.EXPIRED,
      expired: expiry.counts.EXPIRED,
      outOfStock: stock.counts.OUT_OF_STOCK,
      lowStock: stock.counts.LOW,
      pendingPOs: vendorsRadar.totalPendingPOs,
      overduePOs: vendorsRadar.vendors.reduce((sum, v) => sum + v.overdue_pos, 0),
    }
  }

  return {
    role,
    radarSummary,
    // True when the top-products ranking only saw the newest 300
    // sale_items (M11): the dashboard says so instead of ranking
    // a partial history silently.
    topProductsTruncated: (saleItemsRes.count ?? 0) > 300,
    user_name: profile?.full_name || 'Staff Member',
    stats: {
      lowStock: lowStockCount,
      expiringBatches: expiringBatchesList.length,
      totalCategories: categoriesCountRes.count || 0,
      totalProducts: productsCountRes.count || 0,
      currentMonthSales,
      currentMonthOrders,
      lastMonthSales,
      salesGrowth,
      todaySalesTotal,
      todaySalesCount,
      activeTasksCount: activeTasks.length
    },
    dailyTrend,
    recentSales,
    topCheeses,
    lowStockItems,
    expiringBatches,
    activeTasks
  }
}

export async function getExecutiveDashboardStats() {
  const data = await getCheeseCommandCenterData()
  return {
    lowStock: data.stats.lowStock,
    expiringBatches: data.stats.expiringBatches,
    totalCategories: data.stats.totalCategories,
    totalProducts: data.stats.totalProducts,
    currentMonthSales: data.stats.currentMonthSales,
    lastMonthSales: data.stats.lastMonthSales,
    salesGrowth: data.stats.salesGrowth,
  }
}
