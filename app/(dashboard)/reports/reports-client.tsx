'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  TrendingUp,
  Package,
  AlertTriangle,
  Truck,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  PieChart
} from 'lucide-react'

export function ReportsClient({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'vendors' | 'pnl'>('sales')
  const [salesPeriod, setSalesPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month')

  const { salesMetrics, stockMetrics, vendorMetrics, pnlSummary, userRole } = data
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'

  const currentSales =
    salesPeriod === 'today'
      ? salesMetrics.today
      : salesPeriod === 'week'
      ? salesMetrics.week
      : salesPeriod === 'month'
      ? salesMetrics.month
      : { total: salesMetrics.allTimeTotal, count: salesMetrics.dailyTrend.reduce((s: number, d: any) => s + d.count, 0) }

  const avgTicket = currentSales.count > 0 ? currentSales.total / currentSales.count : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Analytics & Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Operational reporting, cheese inventory movements, supplier purchasing, and financial performance.
        </p>
      </div>

      {/* Tabs Header */}
      <div className="flex flex-wrap gap-2 border-b border-border/80 pb-3">
        <Button
          variant={activeTab === 'sales' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('sales')}
          className="gap-2 cursor-pointer"
        >
          <BarChart3 className="h-4 w-4" />
          Sales Reports
        </Button>
        <Button
          variant={activeTab === 'inventory' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('inventory')}
          className="gap-2 cursor-pointer"
        >
          <Layers className="h-4 w-4" />
          Stock & Spoilage
        </Button>
        <Button
          variant={activeTab === 'vendors' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('vendors')}
          className="gap-2 cursor-pointer"
        >
          <Truck className="h-4 w-4" />
          Vendor Purchases
        </Button>
        {isOwnerOrAdmin && (
          <Button
            variant={activeTab === 'pnl' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('pnl')}
            className="gap-2 cursor-pointer"
          >
            <DollarSign className="h-4 w-4" />
            P&L Summary (Owner)
          </Button>
        )}
      </div>

      {/* 1. SALES REPORT TAB */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm font-medium text-muted-foreground">Select Reporting Horizon:</div>
            <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/60">
              {(['today', 'week', 'month', 'all'] as const).map((period) => (
                <Button
                  key={period}
                  variant={salesPeriod === period ? 'default' : 'ghost'}
                  size="xs"
                  onClick={() => setSalesPeriod(period)}
                  className="capitalize cursor-pointer"
                >
                  {period === 'all' ? 'All Time' : period === 'today' ? 'Today' : `This ${period}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Gross Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">${currentSales.total.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Revenue for selected period</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Completed Invoices</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">{currentSales.count}</div>
                <p className="text-xs text-muted-foreground mt-1">Total customer transactions</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Average Ticket</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">${avgTicket.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Spend per customer order</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent 7-Day Sales Activity</CardTitle>
                <CardDescription>Daily breakdown of completed checkouts and revenue.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesMetrics.dailyTrend.map((d: any) => (
                      <TableRow key={d.date}>
                        <TableCell className="font-medium">{d.date}</TableCell>
                        <TableCell className="text-center">{d.count}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">${d.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>Highest volume cheese products sold.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Units Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesMetrics.topSellingProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          No product sales recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {salesMetrics.topSellingProducts.map((p: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-center">{p.quantity}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">${p.revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 2. STOCK & WASTAGE REPORT TAB */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Stock Received</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">+{stockMetrics.stockInTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Purchases & opening stock</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Stock Sold</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">-{stockMetrics.stockOutTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Customer sales through POS</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Spoilage & Wastage</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-destructive">{stockMetrics.wastageTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Expired or damaged cheese</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Returns Restocked</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">+{stockMetrics.returnsTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Returned items restocked</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Perishable Spoilage Analysis</CardTitle>
              <CardDescription>Track which cheese lines experience spoilage or packaging damage.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Line</TableHead>
                    <TableHead className="text-right">Units Lost</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMetrics.topWastedProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No spoilage or wastage logged. Excellent cheese inventory health!
                      </TableCell>
                    </TableRow>
                  )}
                  {stockMetrics.topWastedProducts.map((w: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{w.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">Spoilage Logged</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. VENDOR PURCHASES TAB */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Supplier Spend</CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">${vendorMetrics.totalVendorSpend.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all vendor purchase orders</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Purchase Orders Placed</CardTitle>
                <Truck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">{vendorMetrics.totalVendorOrders}</div>
                <p className="text-xs text-muted-foreground mt-1">Total procurement contracts</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vendor-wise Purchase Summary</CardTitle>
              <CardDescription>Procurement volume and spend grouped by supplier.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor / Supplier</TableHead>
                    <TableHead className="text-center">Total POs</TableHead>
                    <TableHead className="text-right">Total Procurement Spend</TableHead>
                    <TableHead className="text-right">Last Purchase Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorMetrics.vendorSummary.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No vendor purchase orders recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {vendorMetrics.vendorSummary.map((v: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-foreground">{v.vendorName}</TableCell>
                      <TableCell className="text-center">{v.orderCount}</TableCell>
                      <TableCell className="text-right font-medium text-foreground">${v.totalSpent.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{v.lastOrder}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. PROFIT & LOSS SUMMARY TAB (OWNER / ADMIN ONLY) */}
      {activeTab === 'pnl' && isOwnerOrAdmin && pnlSummary && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">${pnlSummary.totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">From all customer sales</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Cost of Goods (COGS)</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">${pnlSummary.cogs.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Direct product costs</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Gross Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-primary">${pnlSummary.grossProfit.toFixed(2)}</div>
                <p className="text-xs font-medium text-primary mt-1">{pnlSummary.grossMarginPct.toFixed(1)}% Gross Margin</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Net Profit</CardTitle>
                <PieChart className={`h-4 w-4 ${pnlSummary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${pnlSummary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  ${pnlSummary.netProfit.toFixed(2)}
                </div>
                <p className={`text-xs font-medium mt-1 ${pnlSummary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {pnlSummary.netMarginPct.toFixed(1)}% Net Margin
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Executive Profit & Loss Statement</CardTitle>
              <CardDescription>Confidential breakdown of revenues, inventory COGS, operational overhead, and net margin.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-xl text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-medium">Total Sales Revenue</span>
                  <span className="font-semibold text-foreground">${pnlSummary.totalRevenue.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-2 border-b text-muted-foreground">
                  <span className="pl-4">Less: Cost of Goods Sold (COGS)</span>
                  <span className="text-destructive font-mono">-${pnlSummary.cogs.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-2 border-b font-semibold bg-muted/20 px-2 rounded">
                  <span>Gross Profit</span>
                  <span className="text-primary font-mono">${pnlSummary.grossProfit.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-2 border-b text-muted-foreground">
                  <span className="pl-4">Less: General & Administrative Expenses</span>
                  <span className="text-destructive font-mono">-${pnlSummary.operatingExpenses.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-2 border-b text-muted-foreground">
                  <span className="pl-4">Less: Disbursed Staff Payroll</span>
                  <span className="text-destructive font-mono">-${pnlSummary.paidPayroll.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-3 border-t-2 border-primary/40 text-base font-bold bg-primary/10 px-3 rounded-lg text-foreground">
                  <span>Net Bottom-Line Profit / (Loss)</span>
                  <span className={pnlSummary.netProfit >= 0 ? 'text-primary font-mono' : 'text-destructive font-mono'}>
                    ${pnlSummary.netProfit.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
