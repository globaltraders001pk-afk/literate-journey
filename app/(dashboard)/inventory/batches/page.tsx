import { getBatches, getProducts } from '@/app/actions/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BatchForm } from './batch-form'
import { truncationNote } from '@/lib/pagination'

export default async function BatchesPage() {
  const [{ rows: batches, total: batchesTotal }, { rows: products }] = await Promise.all([
    getBatches(),
    getProducts()
  ])
  const batchesNote = truncationNote(batchesTotal, batches.length, 'batches')

  // Helper to color code expiry. Batches with no known expiry date
  // (auto-created from stock-in without one) show "No Expiry".
  const getExpiryStatus = (dateString: string | null) => {
    if (!dateString) return { label: 'No Expiry', variant: 'secondary' as const }
    const expiry = new Date(dateString)
    const today = new Date()
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { label: 'Expired', variant: 'destructive' as const }
    if (diffDays <= 30) return { label: `Expiring in ${diffDays}d`, variant: 'destructive' as const }
    if (diffDays <= 90) return { label: `Expiring in ${diffDays}d`, variant: 'secondary' as const }
    return { label: 'Good', variant: 'default' as const }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Product Batches & Expiry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track perishable inventory batches and expiry dates.</p>
        </div>
        <BatchForm products={products} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Batches</CardTitle>
          <CardDescription>All received batches organized by nearest expiry.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty Rcvd</TableHead>
                <TableHead>Qty Remaining</TableHead>
                <TableHead>Mfg Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No batches found.
                  </TableCell>
                </TableRow>
              )}
              {batches?.map((batch: { id: string; batch_number?: string | null; manufacturing_date?: string | null; expiry_date: string | null; quantity_received?: number | null; quantity_remaining?: number | null; products?: { name?: string | null } | null }) => {
                const status = getExpiryStatus(batch.expiry_date)
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batch_number}</TableCell>
                    <TableCell>{batch.products?.name}</TableCell>
                    <TableCell>{batch.quantity_received}</TableCell>
                    <TableCell className="font-semibold">{batch.quantity_remaining}</TableCell>
                    <TableCell>{batch.manufacturing_date ? new Date(batch.manufacturing_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {batchesNote && (
            <p className="text-xs text-muted-foreground mt-3">{batchesNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
