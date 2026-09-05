import { getCategories } from '@/app/actions/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CategoryForm } from './category-form'

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product categories and discounts.</p>
        </div>
        <CategoryForm />
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
              {categories?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No categories found.
                  </TableCell>
                </TableRow>
              )}
              {categories?.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{cat.description}</TableCell>
                  <TableCell>{cat.default_discount_percentage}%</TableCell>
                  <TableCell>{new Date(cat.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <CategoryForm initialData={cat} />
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
