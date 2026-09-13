'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile, checkAccess } from '@/lib/auth-utils'

export async function getComprehensiveReports() {
  const profile = await getUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const orgId = profile.organization_id
  const isOwnerOrAdmin = profile.role === 'owner' || profile.role === 'admin'

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Execute all reports data queries concurrently in parallel
  const [salesRes, saleItemsRes, movementsRes, purchaseOrdersRes, expensesRes, payrollsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, invoice_number, total_amount, payment_method, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('sale_items')
      .select('quantity, subtotal, products(name, cost_price)')
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
      : Promise.resolve({ data: [] as any[] }),
    isOwnerOrAdmin
      ? supabase.from('payroll').select('net_salary').eq('organization_id', orgId).eq('status', 'paid')
      : Promise.resolve({ data: [] as any[] })
  ])

  const allSales = salesRes.data || []
  const saleItems = saleItemsRes.data || []
  const movements = movementsRes.data || []
  const purchaseOrders = purchaseOrdersRes.data || []
  const expenses = expensesRes.data || []
  const payrolls = payrollsRes.data || []

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
    const key = d.toISOString().split('T')[0]
    dailyTrendMap.set(key, { count: 0, amount: 0 })
  }

  allSales.forEach((sale: any) => {
    const saleDate = new Date(sale.created_at)
    const saleDateStr = sale.created_at.split('T')[0]
    const amount = parseFloat(sale.total_amount) || 0

    if (saleDateStr === todayStr) {
      todaySalesTotal += amount
      todaySalesCount++
    }
    if (saleDate >= sevenDaysAgo) {
      weekSalesTotal += amount
      weekSalesCount++
    }
    if (saleDate >= new Date(firstDayOfMonth)) {
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

  // Top Products
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number; cogs: number }>()
  let totalCogs = 0

  saleItems.forEach((item: any) => {
    const name = Array.isArray(item.products) ? item.products[0]?.name : item.products?.name
    const costPrice = Array.isArray(item.products) ? parseFloat(item.products[0]?.cost_price) || 0 : parseFloat(item.products?.cost_price) || 0
    const qty = item.quantity || 0
    const revenue = parseFloat(item.subtotal) || 0
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

  movements.forEach((m: any) => {
    const qty = Math.abs(m.quantity) || 0
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

  purchaseOrders.forEach((po: any) => {
    const vendorName = Array.isArray(po.vendors) ? po.vendors[0]?.name : po.vendors?.name || 'Unknown Supplier'
    const amount = parseFloat(po.total_amount) || 0
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
    const totalOperatingExpenses = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0)
    const totalPaidPayroll = payrolls.reduce((sum: number, p: any) => sum + (parseFloat(p.net_salary) || 0), 0)

    const totalRevenue = allSales?.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0) || 0
    const grossProfit = totalRevenue - totalCogs
    const totalDeductions = totalOperatingExpenses + totalPaidPayroll
    const netProfit = grossProfit - totalDeductions

    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    pnlSummary = {
      totalRevenue,
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
      allTimeTotal: allSales?.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0) || 0,
      dailyTrend,
      topSellingProducts
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
      totalVendorSpend: purchaseOrders?.reduce((sum, po) => sum + (parseFloat(po.total_amount) || 0), 0) || 0
    },
    pnlSummary,
    userRole: profile.role
  }
}
