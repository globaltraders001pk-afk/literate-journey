import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

export default function BatchesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Product Batches & Expiry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track perishable inventory batches and expiry dates.</p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          <span>Record New Batch</span>
        </div>
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
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24 rounded font-mono" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
