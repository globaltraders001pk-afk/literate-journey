import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

export default function VendorsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Vendors & Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage material, equipment, and packaging suppliers, agreed rates, and order history.
          </p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          <span>Add Vendor</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>A directory of all suppliers with supply details and transaction logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Items Supplied</TableHead>
                <TableHead>Agreed Rates</TableHead>
                <TableHead>Phone / Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32 rounded font-medium" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-24 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-36 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24 rounded" />
                      <Skeleton className="h-2.5 w-28 rounded" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
