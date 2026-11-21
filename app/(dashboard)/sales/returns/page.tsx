import { getReturns } from '@/app/actions/returns'
import { getProducts } from '@/app/actions/inventory'
import { getCustomers } from '@/app/actions/sales'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ReturnForm } from './return-form'
import { truncationNote } from '@/lib/pagination'

export default async function ReturnsPage() {
  const [{ rows: returns, total: returnsTotal }, { rows: products }, { rows: customers }] =
    await Promise.all([getReturns(), getProducts(), getCustomers()])
  const returnsNote = truncationNote(returnsTotal, returns.length, 'returns')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Returns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Process customer returns and update inventory.</p>
        </div>
        <ReturnForm products={products} customers={customers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Return History</CardTitle>
          <CardDescription>A log of all processed returns and refunds.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Refund Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No returns found.
                  </TableCell>
                </TableRow>
              )}
              {returns?.map((ret: { id: string; return_number?: string | null; refund_amount?: number | string | null; created_at: string; customers?: { name?: string | null } | null; return_items?: Array<{ quantity?: number | null; return_action: string; products?: { name?: string | null } | null }> | null }) => {
                const item = ret.return_items?.[0]
                return (
                  <TableRow key={ret.id}>
                    <TableCell className="font-medium">{ret.return_number}</TableCell>
                    <TableCell>{ret.customers?.name || 'Walk-in'}</TableCell>
                    <TableCell>
                      {item ? `${item.quantity}x ${item.products?.name}` : 'No items'}
                    </TableCell>
                    <TableCell>
                      {item && (
                        <Badge variant={item.return_action === 'restock' ? 'default' : 'destructive'}>
                          {item.return_action.toUpperCase()}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>${ret.refund_amount}</TableCell>
                    <TableCell>{new Date(ret.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {returnsNote && (
            <p className="text-xs text-muted-foreground mt-3">{returnsNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
