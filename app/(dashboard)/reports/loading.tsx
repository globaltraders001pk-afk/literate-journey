import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart3, Layers, Truck, DollarSign, Calendar, TrendingUp } from 'lucide-react'

export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Analytics & Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Operational reporting, product inventory movements, supplier purchasing, and financial performance.
        </p>
      </div>

      {/* 2. Tabs Header */}
      <div className="flex flex-wrap gap-2 border-b border-border/80 pb-3">
        <div className="h-8 px-3 rounded-md bg-primary text-primary-foreground flex items-center gap-2 text-xs font-medium">
          <BarChart3 className="h-4 w-4" />
          <span>Sales Reports</span>
        </div>
        <div className="h-8 px-3 rounded-md border border-border/60 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>Stock & Spoilage</span>
        </div>
        <div className="h-8 px-3 rounded-md border border-border/60 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Truck className="h-4 w-4" />
          <span>Vendor Purchases</span>
        </div>
        <div className="h-8 px-3 rounded-md border border-border/60 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span>P&L Summary (Owner)</span>
        </div>
      </div>

      {/* 3. Period Selector Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-medium text-muted-foreground">Select Reporting Horizon:</div>
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/60">
          <div className="h-6 px-2 rounded-md bg-muted text-[11px] font-medium flex items-center">Today</div>
          <div className="h-6 px-2 rounded-md text-[11px] font-medium text-muted-foreground flex items-center">This week</div>
          <div className="h-6 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium flex items-center">This month</div>
          <div className="h-6 px-2 rounded-md text-[11px] font-medium text-muted-foreground flex items-center">All Time</div>
        </div>
      </div>

      {/* 4. Three Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Gross Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28 rounded-md" />
            <p className="text-xs text-muted-foreground mt-1">Revenue for selected period</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Completed Invoices</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 rounded-md" />
            <p className="text-xs text-muted-foreground mt-1">Total customer transactions</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Average Ticket</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 rounded-md" />
            <p className="text-xs text-muted-foreground mt-1">Spend per customer order</p>
          </CardContent>
        </Card>
      </div>

      {/* 5. Two Cards Side-by-Side: 7-Day Activity & Top Selling Products */}
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
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24 rounded font-medium" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-8 rounded mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 rounded ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Highest volume products sold.</CardDescription>
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
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32 rounded font-medium" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-10 rounded mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-14 rounded ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
