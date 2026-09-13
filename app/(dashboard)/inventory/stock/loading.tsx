import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function StockLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Stock Levels</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View real-time inventory levels calculated from movements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Inventory</CardTitle>
          <CardDescription>Stock levels for all active products.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Min. Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-36 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded font-mono" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-10 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-18 rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
