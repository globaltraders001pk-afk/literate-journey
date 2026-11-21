import { getPurchaseOrders } from '@/app/actions/purchases'
import { getVendors } from '@/app/actions/vendors'
import { getProducts } from '@/app/actions/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PurchaseForm } from './purchase-form'
import { ReceiveButton } from './receive-button'
import { formatPKR } from '@/lib/format-currency'

export default async function PurchaseOrdersPage() {
  const [orders, vendors, products] = await Promise.all([
    getPurchaseOrders(),
    getVendors(),
    getProducts()
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your purchasing and receiving.</p>
        </div>
        <PurchaseForm vendors={vendors || []} products={products || []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>A list of all purchase orders and their status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No purchase orders found.
                  </TableCell>
                </TableRow>
              )}
              {orders?.map((po: any) => {
                const item = po.purchase_order_items?.[0]
                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.vendors?.name}</TableCell>
                    <TableCell>
                      {item ? `${item.quantity}x ${item.products?.name}` : 'No items'}
                    </TableCell>
                    <TableCell>{formatPKR(po.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={po.status === 'received' ? 'default' : 'secondary'}>
                        {po.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {po.status === 'sent' && item && (
                        <ReceiveButton 
                          poId={po.id} 
                          itemId={item.id} 
                          productId={item.product_id} 
                          quantity={item.quantity} 
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
