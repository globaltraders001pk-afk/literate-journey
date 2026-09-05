'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth-utils'
import { getDashboardStats as getInventoryStats, getStockLevels, getBatches } from '@/app/actions/inventory'
import { getTasks } from '@/app/actions/tasks'

export async function getCheeseCommandCenterData() {
  const [profile, supabase] = await Promise.all([
    getUserProfile(),
    createClient()
  ])

  const isEmployee = profile?.role === 'employee'
  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  const date = new Date()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const todayStr = date.toISOString().split('T')[0]

  // 1. Inventory & Base stats
  const inventoryStats = await getInventoryStats()

  // 2. Monthly Sales
  const { data: monthSales } = await supabase
    .from('sales')
    .select('total_amount, created_at')
    .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)
    .lt('created_at', month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`)

  const currentMonthSales = monthSales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0
  const currentMonthOrders = monthSales?.length || 0

  // Last Month Sales for comparison
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { data: prevSales } = await supabase
    .from('sales')
    .select('total_amount')
    .gte('created_at', `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`)
    .lt('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)

  const lastMonthSales = prevSales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0
  const salesGrowth = lastMonthSales === 0 ? 100 : ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100

  // Today's Sales
  const todaySales = monthSales?.filter(s => s.created_at.startsWith(todayStr)) || []
  const todaySalesTotal = todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const todaySalesCount = todaySales.length

  // 7-Day Trend
  const sevenDaysAgo = new Date(date)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data: weekSales } = await supabase
    .from('sales')
    .select('total_amount, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: true })

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const trendMap = new Map<string, { day: string; date: string; amount: number; count: number }>()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(date)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    trendMap.set(key, {
      day: dayNames[d.getDay()],
      date: key,
      amount: 0,
      count: 0
    })
  }

  weekSales?.forEach((s: any) => {
    const key = s.created_at.split('T')[0]
    if (trendMap.has(key)) {
      const item = trendMap.get(key)!
      item.amount += Number(s.total_amount) || 0
      item.count++
    }
  })

  const dailyTrend = Array.from(trendMap.values())

  // 3. Recent Sales Transactions
  const { data: recentSalesRaw } = await supabase
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
    .order('created_at', { ascending: false })
    .limit(6)

  const recentSales = (recentSalesRaw || []).map((s: any) => {
    const customerName = Array.isArray(s.customers) ? s.customers[0]?.name : s.customers?.name
    const itemsCount = s.sale_items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0
    const primaryItem = s.sale_items?.[0]?.products?.name || 'Assorted Cheese'
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

  // 4. Top Selling Cheeses
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('quantity, subtotal, products (id, name, sku)')

  const productMap = new Map<string, { id: string; name: string; sku: string; quantity: number; revenue: number }>()
  saleItems?.forEach((item: any) => {
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

  // 5. Perishable Cheese Alerts: Low Stock & Expiring Batches
  const allStock = await getStockLevels()
  const lowStockItems = allStock
    .filter((p: any) => p.status === 'Low Stock' || p.status === 'Out of Stock')
    .slice(0, 5)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      current_stock: p.current_stock,
      minimum_stock_level: p.minimum_stock_level || 5,
      status: p.status
    }))

  const allBatches = await getBatches()
  const nowTime = new Date().getTime()
  const expiringBatches = (allBatches || [])
    .filter((b: any) => {
      if (!b.expiry_date || b.quantity_remaining <= 0) return false
      const exp = new Date(b.expiry_date).getTime()
      const diffDays = Math.ceil((exp - nowTime) / (1000 * 60 * 60 * 24))
      return diffDays <= 30
    })
    .slice(0, 5)
    .map((b: any) => {
      const exp = new Date(b.expiry_date).getTime()
      const diffDays = Math.ceil((exp - nowTime) / (1000 * 60 * 60 * 24))
      const prodName = Array.isArray(b.products) ? b.products[0]?.name : b.products?.name
      return {
        id: b.id,
        batch_number: b.batch_number,
        product_name: prodName || 'Cheese Batch',
        quantity_remaining: b.quantity_remaining,
        expiry_date: b.expiry_date,
        days_left: diffDays
      }
    })

  // 6. Active Tasks
  const allTasks = await getTasks()
  const activeTasks = (allTasks || [])
    .filter((t: any) => t.status !== 'DONE')
    .slice(0, 5)

  return {
    role: profile?.role || 'employee',
    user_name: profile?.full_name || 'Staff Member',
    stats: {
      ...inventoryStats,
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
