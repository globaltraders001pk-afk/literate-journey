import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

export default function CategoriesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product categories and discounts.</p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>A list of all categories in your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Default Discount</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-48 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
