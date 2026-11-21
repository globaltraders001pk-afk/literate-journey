'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatPKR } from '@/lib/format-currency'
import { formatShortDate, formatShortDatePKT } from '@/lib/dates'
import type {
  RadarsBundle,
  ExpiryBand,
  StockStatus,
} from '@/app/actions/radars'

type Tab = 'expiry' | 'stock' | 'inventory' | 'vendors'

const EXPIRY_BANDS: { key: ExpiryBand; label: string; hint: string; badgeClass: string }[] = [
  { key: 'EXPIRED', label: 'Expired', hint: 'Already past expiry', badgeClass: 'bg-destructive text-destructive-foreground' },
  { key: 'URGENT', label: 'Urgent · under 30 days', hint: 'Expires within 30 days', badgeClass: 'bg-amber-500 text-white' },
  // WARNING is days 30–119: the old "30–120 days" label was off by
  // one — day 120 is already WATCH (QA audit L8).
  { key: 'WARNING_4M', label: 'Warning · 30–119 days', hint: 'Expires in 30–119 days', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' },
  { key: 'WATCH_6M', label: 'Watch · 120–180 days', hint: 'Expires in 120–180 days', badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30' },
  { key: 'HEALTHY', label: 'Healthy · over 180 days', hint: 'More than 6 months left', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' },
]

const EXPIRY_BADGE: Record<ExpiryBand, string> = Object.fromEntries(
  EXPIRY_BANDS.map((b) => [b.key, b.badgeClass])
) as Record<ExpiryBand, string>

const EXPIRY_LABEL: Record<ExpiryBand, string> = {
  EXPIRED: 'Expired',
  URGENT: 'Urgent',
  WARNING_4M: 'Warning · 4M',
  WATCH_6M: 'Watch · 6M',
  HEALTHY: 'Healthy',
}

const STOCK_BADGE: Record<StockStatus, string> = {
  OUT_OF_STOCK: 'bg-destructive text-destructive-foreground',
  LOW: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
  HEALTHY: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
}

const STOCK_LABEL: Record<StockStatus, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  LOW: 'Low Stock',
  HEALTHY: 'Healthy',
}

function formatDate(dateStr: string | null): string {
  // Expiry dates are bare YYYY-MM-DD: local calendar components.
  return formatShortDate(dateStr)
}

function formatTimestamp(dateStr: string | null): string {
  // Full timestamps (e.g. last order): the PKT calendar date.
  return formatShortDatePKT(dateStr)
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} days overdue`
  if (daysLeft === 0) return 'Expires today'
  if (daysLeft === 1) return '1 day left'
  return `${daysLeft} days left`
}

function CountCard({ label, value, hint, tone }: { label: string; value: number | string; hint: string; tone?: 'danger' | 'warn' | 'ok' }) {
  return (
    <Card className={cn('border-border/70 shadow-xs', tone === 'danger' && 'border-destructive/40 bg-destructive/5', tone === 'warn' && 'border-amber-500/40 bg-amber-500/5')}>
      <CardContent className="pt-4 pb-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}

/** Error state for one failed radar tab (M4): the message plus a
 * retry that re-runs the server loader. */
function RadarError({ title, message }: { title: string; message: string }) {
  const router = useRouter()
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{title} could not be loaded</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

export function RadarsClient({ bundle }: { bundle: RadarsBundle }) {
  const [tab, setTab] = useState<Tab>('expiry')
  const { expiry, expiryError, stock, stockError, inventory, inventoryError, vendors, vendorsError } = bundle

  // Tab badge meanings (L8), one rule each: the count is the tab's
  // headline alert count — expiring within 180 days, out-of-stock
  // + low, products with negative stock, vendors with an overdue PO.
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'expiry', label: 'Expiry', count: expiry?.expiringWithin180Days ?? 0 },
    { key: 'stock', label: 'Stock', count: (stock?.counts.OUT_OF_STOCK ?? 0) + (stock?.counts.LOW ?? 0) },
    { key: 'inventory', label: 'Inventory', count: inventory?.negativeStock.length ?? 0 },
    { key: 'vendors', label: 'Vendors', count: vendors?.vendorsWithOverdue ?? 0 },
  ]

  // The expiry table lists only batches expiring within 180 days
  // (L8): HEALTHY batches are counted in the cards above, not
  // listed under a "within 180 days" heading.
  const expiringBatches = (expiry?.batches ?? []).filter((b) => b.band !== 'HEALTHY')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Radars</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Early warnings for expiry, stock, inventory movement and suppliers — so nothing runs out or expires unnoticed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? 'default' : 'outline'}
            onClick={() => setTab(t.key)}
            className="gap-1.5 cursor-pointer"
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                tab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {t.count}
              </span>
            )}
          </Button>
        ))}
      </div>

      {tab === 'expiry' && (expiryError || !expiry ? (
        <RadarError title="Expiry radar" message={expiryError || 'No expiry data was returned.'} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {EXPIRY_BANDS.map((band) => (
              <CountCard
                key={band.key}
                label={band.label}
                value={expiry.counts[band.key]}
                hint={band.hint}
                tone={band.key === 'EXPIRED' ? 'danger' : band.key === 'URGENT' ? 'warn' : undefined}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Batches by Expiry</CardTitle>
              <CardDescription>
                {expiry.expiringWithin180Days} batch{expiry.expiringWithin180Days === 1 ? '' : 'es'} expiring within 180 days (6 months), most urgent first. Batches with no stock left are not listed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch No.</TableHead>
                    <TableHead>Qty Left</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Band</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringBatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {expiry.totalBatchesWithStock === 0
                          ? 'No batches with stock on hand.'
                          : 'No batches expiring within 180 days. All stocked batches are healthy.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {expiringBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{batch.batch_number}</TableCell>
                      <TableCell className="font-semibold">{batch.quantity_remaining}</TableCell>
                      <TableCell>{formatDate(batch.expiry_date)}</TableCell>
                      <TableCell className={cn(batch.days_left < 0 && 'text-destructive font-medium')}>
                        {formatDaysLeft(batch.days_left)}
                      </TableCell>
                      <TableCell>
                        <Badge className={EXPIRY_BADGE[batch.band]}>{EXPIRY_LABEL[batch.band]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ))}

      {tab === 'stock' && (stockError || !stock ? (
        <RadarError title="Stock radar" message={stockError || 'No stock data was returned.'} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <CountCard label="Out of Stock" value={stock.counts.OUT_OF_STOCK} hint="No stock on hand" tone="danger" />
            <CountCard label="Low Stock" value={stock.counts.LOW} hint="At or below minimum stock level" tone="warn" />
            <CountCard label="Healthy" value={stock.counts.HEALTHY} hint="Above minimum stock level" tone="ok" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stock Levels</CardTitle>
              <CardDescription>
                Current stock is the sum of all inventory movements per product. Low means at or below the product&apos;s minimum stock level — 10 when no minimum is set (a stored 0 counts as unset).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min. Level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No products found.
                      </TableCell>
                    </TableRow>
                  )}
                  {stock.products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || '-'}</TableCell>
                      <TableCell className={cn('font-semibold', product.current_stock <= 0 && 'text-destructive')}>
                        {product.current_stock}
                      </TableCell>
                      <TableCell>{product.minimum_stock_level}</TableCell>
                      <TableCell>
                        <Badge className={STOCK_BADGE[product.status]}>{STOCK_LABEL[product.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ))}

      {tab === 'inventory' && (inventoryError || !inventory ? (
        <RadarError title="Inventory radar" message={inventoryError || 'No inventory data was returned.'} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Movements by Type</CardTitle>
              <CardDescription>Last 30 days, with the last 7 days alongside. Quantities are signed as stored: stock-out and wastage are negative. Total Qty is the signed net; In / Out split it.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Movement Type</TableHead>
                    <TableHead>Count · 30 days</TableHead>
                    <TableHead>Total Qty · 30 days</TableHead>
                    <TableHead>In · 30 days</TableHead>
                    <TableHead>Out · 30 days</TableHead>
                    <TableHead>Count · 7 days</TableHead>
                    <TableHead>Total Qty · 7 days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.byType.map((row) => (
                    <TableRow key={row.movement_type}>
                      <TableCell className="font-medium">{row.movement_type.replace('_', ' ')}</TableCell>
                      <TableCell>{row.count30d}</TableCell>
                      <TableCell className="font-semibold">{row.totalQuantity30d}</TableCell>
                      <TableCell>{row.inQuantity30d}</TableCell>
                      <TableCell>{row.outQuantity30d}</TableCell>
                      <TableCell>{row.count7d}</TableCell>
                      <TableCell className="font-semibold">{row.totalQuantity7d}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Movers · Last 30 Days</CardTitle>
              <CardDescription>Products with the most units moved (in or out), by absolute quantity — split into units moved in and out.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Movements</TableHead>
                    <TableHead>Total Units Moved</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.topMovers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No movements in the last 30 days.
                      </TableCell>
                    </TableRow>
                  )}
                  {inventory.topMovers.map((mover) => (
                    <TableRow key={mover.product_id}>
                      <TableCell className="font-medium">{mover.product_name}</TableCell>
                      <TableCell>{mover.sku || '-'}</TableCell>
                      <TableCell>{mover.movements}</TableCell>
                      <TableCell className="font-semibold">{mover.totalQuantity}</TableCell>
                      <TableCell>{mover.inQuantity}</TableCell>
                      <TableCell>{mover.outQuantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className={inventory.negativeStock.length > 0 ? 'border-destructive/40' : ''}>
            <CardHeader>
              <CardTitle>Negative Stock · Anomaly</CardTitle>
              <CardDescription>Products whose computed stock (sum of movements) is below zero. This should not happen — check sales, wastage and adjustments for these products.</CardDescription>
            </CardHeader>
            <CardContent>
              {inventory.negativeStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products with negative stock. All good.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Min. Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.negativeStock.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku || '-'}</TableCell>
                        <TableCell className="font-semibold text-destructive">{product.current_stock}</TableCell>
                        <TableCell>{product.minimum_stock_level}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ))}

      {tab === 'vendors' && (vendorsError || !vendors ? (
        <RadarError title="Vendors radar" message={vendorsError || 'No vendor data was returned.'} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <CountCard label="Total Vendors" value={vendors.totalVendors} hint="Suppliers on record" />
            <CountCard label="Active Vendors" value={vendors.activeVendors} hint="Marked active" tone="ok" />
            <CountCard label="Pending POs" value={vendors.totalPendingPOs} hint="Purchase orders not yet received" tone={vendors.totalPendingPOs > 0 ? 'warn' : undefined} />
            <CountCard label="Vendors with Overdue POs" value={vendors.vendorsWithOverdue} hint="Pending PO older than 30 days" tone={vendors.vendorsWithOverdue > 0 ? 'danger' : undefined} />
            <CountCard label="Outstanding PO Amount" value={formatPKR(vendors.totalOutstandingPayable)} hint="Value of goods ordered but not yet received" tone={vendors.totalOutstandingPayable > 0 ? 'warn' : undefined} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vendors &amp; Purchase Orders</CardTitle>
              <CardDescription>
                Pending means a purchase order that has not been received yet. Overdue means a pending order older than 30 days. Outstanding is the value of goods ordered but not yet received.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total POs</TableHead>
                    <TableHead>Pending POs</TableHead>
                    <TableHead>Overdue POs</TableHead>
                    <TableHead className="text-right">Outstanding (PKR)</TableHead>
                    <TableHead>Last Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.vendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No vendors found. Add vendors from the Purchases page.
                      </TableCell>
                    </TableRow>
                  )}
                  {vendors.vendors.map((vendor) => (
                    <TableRow key={vendor.id} className={cn(vendor.has_overdue && 'bg-destructive/5')}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{vendor.contact_person || '-'}</div>
                        <div>{vendor.phone || vendor.email || ''}</div>
                      </TableCell>
                      <TableCell>
                        {vendor.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell>{vendor.total_pos}</TableCell>
                      <TableCell className={cn(vendor.pending_pos > 0 && 'font-semibold')}>{vendor.pending_pos}</TableCell>
                      <TableCell>
                        {vendor.overdue_pos > 0 ? (
                          <Badge variant="destructive">{vendor.overdue_pos} overdue</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatPKR(vendor.outstandingPayable)}</TableCell>
                      <TableCell>{formatTimestamp(vendor.last_order_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {vendors.unknownStatusPOs > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
                  {vendors.unknownStatusPOs} purchase order{vendors.unknownStatusPOs === 1 ? '' : 's'} {vendors.unknownStatusPOs === 1 ? 'has' : 'have'} an unrecognized status and {vendors.unknownStatusPOs === 1 ? 'is' : 'are'} counted as pending.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Manage vendors and orders on the{' '}
                <Link href="/purchases/vendors" className="text-primary underline underline-offset-2">Vendors page</Link>
                {' '}and{' '}
                <Link href="/purchases/orders" className="text-primary underline underline-offset-2">Purchase Orders page</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
