'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatPKR } from '@/lib/format-currency'
import { 
  ShoppingCart, 
  Package, 
  ArrowLeftRight, 
  ListTodo, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Circle,
  ArrowUpRight, 
  Store, 
  ExternalLink,
  Calendar,
  ShieldAlert,
  Flame,
  ChevronRight,
  Boxes
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { updateTaskStatus } from '@/app/actions/tasks'
import type { getCheeseCommandCenterData } from '@/app/actions/dashboard'
import type { RadarSummary } from '@/app/actions/radars'

type DashboardData = Awaited<ReturnType<typeof getCheeseCommandCenterData>>

export function DashboardClient({ data, radarSummary }: { data: DashboardData; radarSummary?: RadarSummary | null }) {
  const { role, user_name, stats, dailyTrend, recentSales, topCheeses, lowStockItems, expiringBatches, activeTasks, topProductsTruncated } = data
  const isEmployee = role === 'employee'
  const isManager = role === 'manager'
  const isAdminOrOwner = role === 'admin' || role === 'owner'

  // Interactive task completion state
  const [tasks, setTasks] = useState(activeTasks)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)

  const handleToggleTask = async (taskId: string) => {
    setCompletingTaskId(taskId)
    setTaskError(null)
    try {
      // updateTaskStatus returns { error } on failure — it never
      // throws — so the old try/catch never fired and the task was
      // removed from local state even when the server update failed
      // (QA audit L5). Only drop it on success.
      const result = await updateTaskStatus(taskId, 'DONE')
      if (result?.error) {
        setTaskError(result.error)
      } else {
        setTasks(prev => prev.filter(t => t.id !== taskId))
      }
    } catch (err) {
      console.error('Failed to update task:', err)
      setTaskError('Could not update the task. Please try again.')
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Calculate max trend amount & counts for scaling bars
  const maxTrendAmount = Math.max(...dailyTrend.map(d => d.amount), 50)
  const maxTrendCount = Math.max(...dailyTrend.map(d => d.count), 5)

  // Current date formatted
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date())

  return (
    <div className="space-y-6">
      
      {/* 1. Header with greeting and Live Operations Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isAdminOrOwner 
                ? 'Executive Business Dashboard' 
                : isManager 
                  ? 'Manager Operations Dashboard' 
                  : 'Shift Operations Dashboard'}
            </h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
              Live
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, <span className="font-medium text-foreground">{user_name}</span>.{' '}
            {isAdminOrOwner
              ? "Here is today's financial summary, inventory health, and store operations."
              : isManager
                ? "Here is today's store inventory health, order volumes, and team shift tasks."
                : "Here is your shift checklist, stock entry, and POS launchpad."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 self-start sm:self-auto">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span>{todayFormatted}</span>
        </div>
      </div>

      {/* 2. Quick Actions Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button 
          size="sm" 
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 font-medium cursor-pointer"
          render={<Link href="/sales/pos" />}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Point of Sale (POS)</span>
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 border-border/80 hover:bg-muted/80 font-medium cursor-pointer"
          render={<Link href="/inventory/movements" />}
        >
          <Package className="h-4 w-4 text-primary" />
          <span>Stock In / Out Entry</span>
        </Button>

        {!isEmployee && (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 border-border/80 hover:bg-muted/80 font-medium cursor-pointer"
              render={<Link href="/purchases/orders" />}
            >
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <span>New Purchase Order</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 border-border/80 hover:bg-muted/80 font-medium cursor-pointer"
              render={<Link href="/inventory/products" />}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>Add New Product</span>
            </Button>
          </>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1.5 text-muted-foreground hover:text-foreground font-medium cursor-pointer ml-auto"
          render={<Link href="/tasks" />}
        >
          <ListTodo className="h-4 w-4" />
          <span>Shift Tasks ({tasks.length})</span>
        </Button>
      </div>

      {/* 3. Enhanced KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1: Monthly Sales / Orders */}
        {isAdminOrOwner ? (
          <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Monthly Sales
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatPKR(stats.currentMonthSales)}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                {stats.salesGrowth === null ? (
                  <span className="text-muted-foreground font-medium">— vs last mo. (no sales last month)</span>
                ) : (
                  <span className={`flex items-center font-medium ${stats.salesGrowth >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {stats.salesGrowth >= 0 ? <TrendingUp className="mr-1 h-3.5 w-3.5" /> : <TrendingDown className="mr-1 h-3.5 w-3.5" />}
                    {Math.abs(stats.salesGrowth).toFixed(1)}% vs last mo.
                  </span>
                )}
                <span className="text-muted-foreground">
                  Today: <strong className="text-foreground">{formatPKR(stats.todaySalesTotal)}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        ) : isManager ? (
          <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Monthly Orders
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.currentMonthOrders ?? 0} Orders
              </div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="text-muted-foreground font-medium">Completed this month</span>
                <span className="text-muted-foreground">
                  Today: <strong className="text-foreground">{stats.todaySalesCount} sales</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Today's Transactions
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.todaySalesCount}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Orders completed today</p>
            </CardContent>
          </Card>
        )}

        {/* Metric 2: Low Stock Alerts */}
        <Card className={`border-border/70 shadow-xs transition-colors ${stats.lowStock > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Low Stock Alerts
            </CardTitle>
            <div className={`p-2 rounded-lg ${stats.lowStock > 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.lowStock}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.lowStock > 0 ? 'Products below minimum reorder level' : 'All inventory levels healthy'}
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Expiring Batches */}
        <Card className={`border-border/70 shadow-xs transition-colors ${stats.expiringBatches > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Expiring Batches
            </CardTitle>
            <div className={`p-2 rounded-lg ${stats.expiringBatches > 0 ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.expiringBatches}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.expiringBatches > 0 ? 'Batches expiring within 30 days' : 'No near-expiry perishable stock'}
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Total Products */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Product Catalog
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Boxes className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active across {stats.totalCategories} categories
            </p>
          </CardContent>
        </Card>

      </div>

      {/* 3b. Radars alert strip — compact early-warning summary, links to /radars.
          Hidden entirely when there is nothing to warn about (QA audit L8):
          a clean system used to show "Expiring within 6 months: 0 (0 urgent…)". */}
      {!isEmployee && radarSummary && (
        (radarSummary.expiringWithin180Days > 0 ||
          radarSummary.urgent30Days > 0 ||
          radarSummary.outOfStock > 0 ||
          radarSummary.lowStock > 0 ||
          radarSummary.pendingPOs > 0 ||
          radarSummary.overduePOs > 0) && (
        <Link href="/radars" className="block">
          <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-colors">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Radars
                </span>
                <span className="text-muted-foreground">
                  Expiring within 6 months: <strong className="text-foreground">{radarSummary.expiringWithin180Days}</strong>
                  {' '}(<span className={radarSummary.urgent30Days > 0 ? 'text-amber-600 font-medium' : ''}>{radarSummary.urgent30Days} urgent · 30 days</span>)
                </span>
                <span className="text-muted-foreground">
                  Out of stock: <strong className={radarSummary.outOfStock > 0 ? 'text-destructive' : 'text-foreground'}>{radarSummary.outOfStock}</strong>
                  {' '}· Low stock: <strong className={radarSummary.lowStock > 0 ? 'text-amber-600' : 'text-foreground'}>{radarSummary.lowStock}</strong>
                </span>
                <span className="text-muted-foreground">
                  Pending vendor POs: <strong className="text-foreground">{radarSummary.pendingPOs}</strong>
                  {radarSummary.overduePOs > 0 && (
                    <span className="text-destructive font-medium"> ({radarSummary.overduePOs} overdue)</span>
                  )}
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs text-primary font-medium">
                  View all radars <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
        )
      )}

      {/* 4. Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* LEFT COLUMN: 7-Day Trend + Recent Sales (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 7-Day Sales Trend & Top Cheeses (for Non-Employees) */}
          {!isEmployee ? (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {isAdminOrOwner ? '7-Day Sales Momentum' : '7-Day Order Volume'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {isAdminOrOwner 
                        ? 'Daily sales performance over the past week' 
                        : 'Daily customer orders and sales activity'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    Past 7 Days
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Visual Bar Chart */}
                <div className="h-44 pt-4 flex items-end justify-between gap-2 border-b border-border/40 pb-2">
                  {dailyTrend.map((d, i) => {
                    const heightPercent = isAdminOrOwner
                      ? Math.min(100, Math.max(10, Math.round((d.amount / maxTrendAmount) * 100)))
                      : Math.min(100, Math.max(10, Math.round((d.count / maxTrendCount) * 100)))
                    const isToday = i === dailyTrend.length - 1
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                          {isAdminOrOwner 
                            ? formatPKR(d.amount) 
                            : `${d.count}`}
                        </span>
                        <div 
                          className="w-full max-w-[40px] rounded-t-md transition-all duration-300 relative group-hover:opacity-90"
                          style={{ 
                            height: `${heightPercent}%`,
                            background: isToday 
                              ? 'var(--primary)' 
                              : (isAdminOrOwner ? d.amount > 0 : d.count > 0) 
                                ? 'linear-gradient(to top, rgba(16, 185, 129, 0.4), rgba(16, 185, 129, 0.8))' 
                                : 'hsl(var(--muted))'
                          }}
                        >
                          {d.count > 0 && (
                            <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-foreground text-background px-1.5 py-0.5 rounded shadow whitespace-nowrap transition-opacity">
                              {d.count} orders
                            </span>
                          )}
                        </div>
                        <div className="text-center">
                          <span className={`text-xs block font-medium ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                            {d.day}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Top-Selling Cheeses Mini Section */}
                {topCheeses.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-amber-500" />
                        Top Performing Products
                      </h4>
                      <Link href="/reports" className="text-xs text-primary hover:underline flex items-center gap-1">
                        Full report <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {topCheeses.map((cheese, index) => (
                        <div key={cheese.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-foreground truncate max-w-[140px]">{cheese.name}</p>
                              <p className="text-[11px] text-muted-foreground">{cheese.quantity} units sold</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {isAdminOrOwner ? (
                              <>
                                <p className="font-semibold text-foreground">{formatPKR(cheese.revenue)}</p>
                                <p className="text-[10px] text-muted-foreground">ex-GST</p>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 font-medium">
                                {cheese.quantity} sold
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {topProductsTruncated && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Ranked from the newest 300 sale lines only — older sales are not included.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Shift Operations Overview for Employees */
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Shift Operations & Guidelines</CardTitle>
                <CardDescription className="text-xs">Quick procedures for daily product handling and inventory control</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Receiving Shipments
                    </p>
                    <p>Always verify temperature upon supplier delivery and log stock entry immediately via the ledger.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Cold Storage Protocol
                    </p>
                    <p>Keep soft and bloomy cheeses between 4°C - 8°C. Inspect packaging for vacuum seal integrity.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Live Sales Activity Feed */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Sales Activity</CardTitle>
                  <CardDescription className="text-xs">Latest transactions completed in the store</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs gap-1 text-primary hover:text-primary cursor-pointer"
                  render={<Link href="/sales/pos" />}
                >
                  <span>Open POS</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg border-border/60">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-foreground">No recent transactions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Start ringing up customer orders in the Point of Sale.</p>
                  <Button 
                    size="sm" 
                    className="mt-3 cursor-pointer"
                    render={<Link href="/sales/pos" />}
                  >
                    Open Point of Sale
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-muted text-muted-foreground">
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground font-mono">{sale.invoice_number}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium uppercase">
                              {sale.payment_method}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {sale.customer_name} • {sale.summary}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {isAdminOrOwner ? (
                          <div className="font-bold text-foreground text-sm">
                            {formatPKR(sale.total_amount)}
                          </div>
                        ) : (
                          <div className="font-medium text-foreground">
                            {sale.items_count} item{sale.items_count === 1 ? '' : 's'}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN: Perishability Radar + Today's Tasks (lg:col-span-1) */}
        <div className="space-y-6">

          {/* Cheese Perishability & Low Stock Radar */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Inventory Radar</CardTitle>
                    <CardDescription className="text-xs">Perishables & low-stock items</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              
              {/* Expiring Batches Sub-section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-500" /> Expiring Soon (&lt;30d)
                  </span>
                  <Link href="/inventory/batches" className="text-[11px] text-primary hover:underline">
                    All batches
                  </Link>
                </div>

                {expiringBatches.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1">No batches expiring in the next 30 days.</p>
                ) : (
                  <div className="space-y-2">
                    {expiringBatches.map(batch => (
                      <div key={batch.id} className="p-2 rounded-md border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{batch.product_name}</p>
                          <p className="text-[11px] text-muted-foreground">Batch #{batch.batch_number} • {batch.quantity_remaining} left</p>
                        </div>
                        <Badge 
                          variant={batch.days_left <= 7 ? 'destructive' : 'outline'}
                          className={`text-[10px] ${batch.days_left > 7 ? 'border-amber-500/40 text-amber-600 bg-amber-500/10' : ''}`}
                        >
                          {batch.days_left <= 0 ? 'Expired' : `${batch.days_left}d left`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Stock Items Sub-section */}
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" /> Low Stock Warning
                  </span>
                  <Link href="/inventory/stock" className="text-[11px] text-primary hover:underline">
                    Stock ledger
                  </Link>
                </div>

                {lowStockItems.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1">All products are above minimum threshold.</p>
                ) : (
                  <div className="space-y-2">
                    {lowStockItems.map(item => (
                      <div key={item.id} className="p-2 rounded-md border border-destructive/20 bg-destructive/5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Stock: <strong className="text-destructive font-bold">{item.current_stock}</strong> / min {item.minimum_stock_level}
                          </p>
                        </div>
                        {isAdminOrOwner || role === 'manager' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] px-2 border-border/70 hover:bg-background cursor-pointer"
                            render={<Link href="/purchases/orders" />}
                          >
                            Reorder
                          </Button>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            {item.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Today's Shift Tasks & Checklist */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Today's Shift Tasks</CardTitle>
                  <CardDescription className="text-xs">
                    {isEmployee ? 'Assigned tasks for your shift' : 'Team operations checklist'}
                  </CardDescription>
                </div>
                <Link href="/tasks" className="text-xs text-primary hover:underline">
                  Manage all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {taskError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5 mb-2">
                  {taskError}
                </p>
              )}
              {tasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-foreground">All tasks completed!</p>
                  <p className="text-[11px] text-muted-foreground">No pending shift tasks at the moment.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => {
                    const isCompleting = completingTaskId === task.id
                    return (
                      <div 
                        key={task.id} 
                        className="p-2 rounded-md border border-border/50 bg-muted/20 flex items-start gap-2.5 text-xs hover:border-border transition-colors"
                      >
                        <button
                          type="button"
                          disabled={isCompleting}
                          onClick={() => handleToggleTask(task.id)}
                          className="mt-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                          title="Mark task as complete"
                        >
                          {isCompleting ? (
                            <Clock className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span className="capitalize font-semibold text-primary">{task.priority}</span>
                            {task.due_date && (
                              <span>Due: {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  )
}
