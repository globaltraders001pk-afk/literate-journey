'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth-utils'
import { addDaysPKT, todayPKT, toPKTDateString } from '@/lib/dates'

export async function getComprehensiveReports() {
  const profile = await getUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const orgId = profile.organization_id
  const isOwnerOrAdmin = profile.role === 'owner' || profile.role === 'admin'

  // Day boundaries are the business's calendar (Asia/Karachi),
  // not UTC (QA audit M9): a sale at 00:30 PKT belongs to the PKT
  // date, and the UTC instant is the previous day.
  const now = new Date()
  const todayStr = todayPKT()

  const sevenDaysAgo = addDaysPKT(now, -7)
  const sevenDaysAgoStr = sevenDaysAgo ? toPKTDateString(sevenDaysAgo) : todayStr

  const firstDayOfMonth = `${todayStr.slice(0, 7)}-01`

  // Execute all reports data queries concurrently in parallel
  const [salesRes, saleItemsRes, movementsRes, purchaseOrdersRes, expensesRes, payrollsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, invoice_number, total_amount, gst_amount, payment_method, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    // sale_items has no organization_id column of its own, so it is
    // scoped through its parent sale (inner join: rows whose sale
    // is in another org never reach the client) — the same pattern
    // dashboard.ts already uses (QA audit H2: this query had no
    // org filter at all before).
    supabase
      .from('sale_items')
      .select('quantity, subtotal, products(name, cost_price), sales!inner(organization_id)', { count: 'exact' })
      .eq('sales.organization_id', orgId)
      .order('id', { ascending: false })
      .limit(500),
    supabase
      .from('inventory_movements')
      .select('movement_type, quantity, products(name)')
      .eq('organization_id', orgId),
    supabase
      .from('purchase_orders')
      .select('total_amount, status, created_at, vendors(name)')
      .eq('organization_id', orgId),
    isOwnerOrAdmin
      ? supabase.from('expenses').select('amount').eq('organization_id', orgId)
      : Promise.resolve({ data: [] as Array<{ amount: number | string }> }),
    isOwnerOrAdmin
      ? supabase.from('payroll').select('net_salary').eq('organization_id', orgId).eq('status', 'paid')
      : Promise.resolve({ data: [] as Array<{ net_salary: number | string }> })
  ])

  // Row shapes pinned here (casts are compile-time only — the
  // data is whatever Supabase returned). Money columns are
  // number | string because PostgREST may return numerics as
  // either; every use below goes through Number(), never
  // parseFloat on a possibly-numeric value.
  const allSales = (salesRes.data || []) as Array<{ created_at: string; total_amount: number | string; gst_amount?: number | string | null }>
  const saleItems = (saleItemsRes.data || []) as Array<{
    quantity: number | string
    subtotal: number | string
    products?: { name?: string | null; cost_price?: number | string | null } | Array<{ name?: string | null; cost_price?: number | string | null }> | null
  }>
  const movements = (movementsRes.data || []) as Array<{
    movement_type: string
    quantity: number | string
    products?: { name?: string | null } | Array<{ name?: string | null }> | null
  }>
  const purchaseOrders = (purchaseOrdersRes.data || []) as Array<{
    total_amount: number | string
    status: string
    created_at: string
    vendors?: { name?: string | null } | Array<{ name?: string | null }> | null
  }>
  const expenses = (expensesRes.data || []) as Array<{ amount: number | string }>
  const payrolls = (payrollsRes.data || []) as Array<{ net_salary: number | string }>

  let todaySalesTotal = 0
  let todaySalesCount = 0
  let weekSalesTotal = 0
  let weekSalesCount = 0
  let monthSalesTotal = 0
  let monthSalesCount = 0

  const dailyTrendMap = new Map<string, { count: number; amount: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = toPKTDateString(d)
    dailyTrendMap.set(key, { count: 0, amount: 0 })
  }

  allSales.forEach((sale) => {
    const saleDateStr = toPKTDateString(sale.created_at)
    const amount = Number(sale.total_amount) || 0

    if (saleDateStr === todayStr) {
      todaySalesTotal += amount
      todaySalesCount++
    }
    if (saleDateStr >= sevenDaysAgoStr) {
      weekSalesTotal += amount
      weekSalesCount++
    }
    if (saleDateStr >= firstDayOfMonth) {
      monthSalesTotal += amount
      monthSalesCount++
    }
    if (dailyTrendMap.has(saleDateStr)) {
      const entry = dailyTrendMap.get(saleDateStr)!
      entry.count++
      entry.amount += amount
    }
  })

  const dailyTrend = Array.from(dailyTrendMap.entries()).map(([date, val]) => ({
    date,
    count: val.count,
    amount: val.amount
  }))

  // Top Products — revenue basis is EX-GST line subtotals (item 4):
  // the same basis the dashboard ranking uses, and the UI labels it
  // so. Sales totals elsewhere are incl-GST grand totals; the two
  // bases must never be compared without saying which is which.
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number; cogs: number }>()
  let totalCogs = 0

  saleItems.forEach((item) => {
    const name = Array.isArray(item.products) ? item.products[0]?.name : item.products?.name
    const costPrice = Array.isArray(item.products) ? Number(item.products[0]?.cost_price) || 0 : Number(item.products?.cost_price) || 0
    const qty = Number(item.quantity) || 0
    const revenue = Number(item.subtotal) || 0
    const cogs = costPrice * qty
    totalCogs += cogs

    if (name) {
      if (!productSalesMap.has(name)) {
        productSalesMap.set(name, { name, quantity: 0, revenue: 0, cogs: 0 })
      }
      const p = productSalesMap.get(name)!
      p.quantity += qty
      p.revenue += revenue
      p.cogs += cogs
    }
  })

  const topSellingProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)

  // 2. Stock Movement & Wastage Data
  let stockInTotal = 0
  let stockOutTotal = 0
  let wastageTotal = 0
  let returnsTotal = 0

  const wastageByProductMap = new Map<string, number>()

  movements.forEach((m) => {
    const qty = Math.abs(Number(m.quantity)) || 0
    const prodName = Array.isArray(m.products) ? m.products[0]?.name : m.products?.name

    if (m.movement_type === 'STOCK_IN') stockInTotal += qty
    if (m.movement_type === 'STOCK_OUT') stockOutTotal += qty
    if (m.movement_type === 'RETURN') returnsTotal += qty
    if (m.movement_type === 'WASTAGE') {
      wastageTotal += qty
      if (prodName) {
        wastageByProductMap.set(prodName, (wastageByProductMap.get(prodName) || 0) + qty)
      }
    }
  })

  const topWastedProducts = Array.from(wastageByProductMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  // 3. Vendor Purchase Report
  const vendorReportMap = new Map<string, { vendorName: string; orderCount: number; totalSpent: number; lastOrder: string }>()

  purchaseOrders.forEach((po) => {
    const vendorName = (Array.isArray(po.vendors) ? po.vendors[0]?.name : po.vendors?.name) || 'Unknown Supplier'
    const amount = Number(po.total_amount) || 0
    const dateStr = po.created_at.split('T')[0]

    if (!vendorReportMap.has(vendorName)) {
      vendorReportMap.set(vendorName, { vendorName, orderCount: 0, totalSpent: 0, lastOrder: dateStr })
    }
    const v = vendorReportMap.get(vendorName)!
    v.orderCount++
    v.totalSpent += amount
    if (dateStr > v.lastOrder) v.lastOrder = dateStr
  })

  const vendorSummary = Array.from(vendorReportMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)

  // 4. Profit & Loss Summary (Owner / Admin Level Only)
  let pnlSummary = null
  if (isOwnerOrAdmin) {
    const totalOperatingExpenses = expenses.reduce((sum: number, e) => sum + (Number(e.amount) || 0), 0)
    const totalPaidPayroll = payrolls.reduce((sum: number, p) => sum + (Number(p.net_salary) || 0), 0)

    // GST (QA audit C4 / item 3): total_amount is the GRAND total
    // (subtotal + GST) for sales made after GST storage, so revenue
    // for profit purposes is ex-GST. GST collected is its own line:
    // money held for the tax authority, not business revenue.
    // Old sales predate the gst_amount column (NULL): they were
    // charged ex-GST with total_amount = subtotal, so they count
    // ex-GST as charged and add 0 to GST collected.
    const totalSalesInclGst = allSales?.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) || 0
    const gstCollected = allSales?.reduce((sum, s) => sum + (Number(s.gst_amount) || 0), 0) || 0
    const totalRevenue = totalSalesInclGst - gstCollected
    const grossProfit = totalRevenue - totalCogs
    const totalDeductions = totalOperatingExpenses + totalPaidPayroll
    const netProfit = grossProfit - totalDeductions

    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    pnlSummary = {
      totalRevenue,
      totalSalesInclGst,
      gstCollected,
      cogs: totalCogs,
      grossProfit,
      grossMarginPct,
      operatingExpenses: totalOperatingExpenses,
      paidPayroll: totalPaidPayroll,
      netProfit,
      netMarginPct
    }
  }

  return {
    salesMetrics: {
      today: { total: todaySalesTotal, count: todaySalesCount },
      week: { total: weekSalesTotal, count: weekSalesCount },
      month: { total: monthSalesTotal, count: monthSalesCount },
      allTimeTotal: allSales?.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0) || 0,
      dailyTrend,
      topSellingProducts,
      // The top-products / COGS math only saw the newest 500 sale
      // lines (M11): the report says so instead of presenting a
      // partial history as complete.
      topProductsTruncated: (saleItemsRes.count ?? 0) > 500,
    },
    stockMetrics: {
      stockInTotal,
      stockOutTotal,
      wastageTotal,
      returnsTotal,
      topWastedProducts
    },
    vendorMetrics: {
      vendorSummary,
      totalVendorOrders: purchaseOrders?.length || 0,
      totalVendorSpend: purchaseOrders?.reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0) || 0
    },
    pnlSummary,
    userRole: profile.role
  }
}
