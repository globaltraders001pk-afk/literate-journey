import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

export default function ReturnsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Returns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Process customer returns and update inventory.</p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          <span>Process Return</span>
        </div>
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
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24 rounded font-mono" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-28 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-36 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
