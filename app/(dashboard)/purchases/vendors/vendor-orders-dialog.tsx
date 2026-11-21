'use client'

import { useState } from 'react'
import { formatPKR } from '@/lib/format-currency'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getVendorOrders } from '@/app/actions/vendors'
import { History, Receipt } from 'lucide-react'

export function VendorOrdersDialog({ vendorId, vendorName }: { vendorId: string, vendorName: string }) {
  const [open, setOpen] = useState(false)
  interface VendorOrder {
    id: string
    po_number?: string | null
    status?: string | null
    total_amount?: number | string | null
    created_at: string
    purchase_order_items?: Array<{
      id: string
      quantity?: number | null
      unit_cost?: number | string | null
      subtotal?: number | string | null
      products?: { name?: string | null } | null
    }> | null
  }

  const [orders, setOrders] = useState<VendorOrder[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setLoading(true)
      const data = await getVendorOrders(vendorId)
      setOrders(data)
      setLoading(false)
    }
  }

  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 cursor-pointer" title="View order history">
          <History className="h-4 w-4" />
        </Button>
      } />
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-lg font-semibold">{vendorName} — Order History</DialogTitle>
              <DialogDescription>All purchase orders and stock receipts from this supplier.</DialogDescription>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Total Spend</span>
              <span className="text-base font-semibold text-primary">{formatPKR(totalSpent)}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading transaction history...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No purchase orders found for this vendor.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((po) => (
                <div key={po.id} className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{po.po_number}</span>
                      <Badge variant={po.status === 'received' ? 'default' : po.status === 'ordered' ? 'secondary' : 'outline'} className="text-xs capitalize">
                        {po.status}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground mr-2">
                        {new Date(po.created_at).toLocaleDateString()}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatPKR(po.total_amount)}
                      </span>
                    </div>
                  </div>

                  {po.purchase_order_items && po.purchase_order_items.length > 0 && (
                    <Table className="text-xs mt-2">
                      <TableHeader>
                        <TableRow className="border-b text-muted-foreground">
                          <TableHead className="py-1">Item</TableHead>
                          <TableHead className="py-1 text-center">Qty</TableHead>
                          <TableHead className="py-1 text-right">Unit Cost</TableHead>
                          <TableHead className="py-1 text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {po.purchase_order_items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="py-1 font-medium">{item.products?.name || 'Raw Material'}</TableCell>
                            <TableCell className="py-1 text-center">{item.quantity}</TableCell>
                            <TableCell className="py-1 text-right">{formatPKR(item.unit_cost)}</TableCell>
                            <TableCell className="py-1 text-right font-medium">{formatPKR(item.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
