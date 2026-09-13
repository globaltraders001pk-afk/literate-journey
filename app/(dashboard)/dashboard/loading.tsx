import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ShoppingCart, 
  Package, 
  ArrowLeftRight, 
  Plus, 
  ListTodo, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  Boxes, 
  Calendar,
  Flame,
  ShieldAlert,
  ChevronRight
} from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      
      {/* 1. Header with greeting and Live Operations Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Executive Business Dashboard
            </h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
              Live
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here is today's financial summary, inventory health, and store operations.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 self-start sm:self-auto">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
      </div>

      {/* 2. Quick Actions Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="h-8 px-3 rounded-lg bg-primary/20 text-primary flex items-center gap-1.5 text-xs font-medium">
          <ShoppingCart className="h-4 w-4" />
          <span>Point of Sale (POS)</span>
        </div>
        <div className="h-8 px-3 rounded-lg border border-border/80 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Package className="h-4 w-4 text-primary" />
          <span>Stock In / Out Entry</span>
        </div>
        <div className="h-8 px-3 rounded-lg border border-border/80 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <span>New Purchase Order</span>
        </div>
        <div className="h-8 px-3 rounded-lg border border-border/80 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Plus className="h-4 w-4 text-primary" />
          <span>Add New Product</span>
        </div>
        <div className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium text-muted-foreground ml-auto">
          <ListTodo className="h-4 w-4" />
          <span>Shift Tasks</span>
        </div>
      </div>

      {/* 3. Enhanced KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1: Monthly Sales */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Monthly Sales
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-28 rounded-md" />
            <div className="flex items-center justify-between text-xs">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3.5 w-20 rounded" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Low Stock Alerts */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Low Stock Alerts
            </CardTitle>
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-12 rounded-md" />
            <Skeleton className="h-3.5 w-44 rounded" />
          </CardContent>
        </Card>

        {/* Metric 3: Expiring Batches */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Expiring Batches
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-12 rounded-md" />
            <Skeleton className="h-3.5 w-48 rounded" />
          </CardContent>
        </Card>

        {/* Metric 4: Product Catalog */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Product Catalog
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Boxes className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-3.5 w-40 rounded" />
          </CardContent>
        </Card>

      </div>

      {/* 4. Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* LEFT COLUMN: 7-Day Trend + Recent Sales (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 7-Day Sales Trend & Top Products */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    7-Day Sales Momentum
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Daily sales performance over the past week
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  Past 7 Days
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visual Bar Chart Skeleton */}
              <div className="h-44 pt-4 flex items-end justify-between gap-2 border-b border-border/40 pb-2">
                {[45, 65, 30, 85, 55, 95, 40].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <Skeleton className="h-3 w-8 rounded" />
                    <Skeleton className="w-full max-w-[40px] rounded-t-md" style={{ height: `${h}%` }} />
                    <Skeleton className="h-3.5 w-6 rounded" />
                  </div>
                ))}
              </div>

              {/* Top-Selling Products Mini Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    Top Performing Products
                  </h4>
                  <Skeleton className="h-3.5 w-20 rounded" />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                          {index + 1}
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3.5 w-28 rounded" />
                          <Skeleton className="h-2.5 w-16 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-12 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Live Sales Activity Feed */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Sales Activity</CardTitle>
                  <CardDescription className="text-xs">Latest transactions completed in the store</CardDescription>
                </div>
                <div className="flex items-center text-xs text-primary gap-1">
                  <span>Open POS</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/40">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted text-muted-foreground">
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-20 rounded font-mono" />
                          <Skeleton className="h-4 w-12 rounded-sm" />
                        </div>
                        <Skeleton className="h-2.5 w-36 rounded" />
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Skeleton className="h-4 w-16 rounded ml-auto" />
                      <Skeleton className="h-2.5 w-10 rounded ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN: Perishability Radar + Today's Tasks (lg:col-span-1) */}
        <div className="space-y-6">

          {/* Cheese Perishability & Low Stock Radar */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Inventory Radar</CardTitle>
                  <CardDescription className="text-xs">Perishables & low-stock items</CardDescription>
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
                  <Skeleton className="h-3 w-16 rounded" />
                </div>

                <div className="space-y-2">
                  {[...Array(2)].map((_, idx) => (
                    <div key={idx} className="p-2 rounded-md border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-28 rounded" />
                        <Skeleton className="h-2.5 w-36 rounded" />
                      </div>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock Items Sub-section */}
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" /> Low Stock Warning
                  </span>
                  <Skeleton className="h-3 w-16 rounded" />
                </div>

                <div className="space-y-2">
                  {[...Array(2)].map((_, idx) => (
                    <div key={idx} className="p-2 rounded-md border border-destructive/20 bg-destructive/5 flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-28 rounded" />
                        <Skeleton className="h-2.5 w-28 rounded" />
                      </div>
                      <Skeleton className="h-6 w-14 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Today's Shift Tasks & Checklist */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Today's Shift Tasks</CardTitle>
                  <CardDescription className="text-xs">Quick action checklist</CardDescription>
                </div>
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-2 rounded-md border border-border/50 bg-muted/10 flex items-start gap-2.5">
                    <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3.5 w-36 rounded" />
                      <Skeleton className="h-2.5 w-20 rounded" />
                    </div>
                    <Skeleton className="h-4 w-12 rounded-sm" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  )
}
