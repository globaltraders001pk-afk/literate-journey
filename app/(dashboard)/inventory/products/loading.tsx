import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

export default function ProductsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product catalog, weights, and pricing.</p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          <span>Add Product</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>A list of all products in your catalog.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Weight / Size</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-24 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3 w-16 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded font-mono" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
