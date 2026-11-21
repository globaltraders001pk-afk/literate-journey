import { getMovements, getProducts } from '@/app/actions/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MovementForm } from './movement-form'

export default async function MovementsPage() {
  const [movements, { rows: products }] = await Promise.all([
    getMovements(),
    getProducts()
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Inventory Movements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Log and view all stock changes.</p>
        </div>
        <MovementForm products={products} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement Log</CardTitle>
          <CardDescription>A chronological log of all stock ins and outs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty Change</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No movements recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {((movements || []) as unknown as Array<{ id: string; movement_type: string; quantity: number; notes?: string | null; created_at: string; products?: { name?: string | null; sku?: string | null } | null; profiles?: { full_name?: string | null } | null }>)?.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>{new Date(mov.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{mov.products?.name} ({mov.products?.sku})</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {mov.movement_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className={mov.quantity > 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
                    {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                  </TableCell>
                  <TableCell>{mov.profiles?.full_name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{mov.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
