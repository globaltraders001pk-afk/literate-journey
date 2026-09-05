import { getExpenseCategories } from '@/app/actions/expenses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CategoryForm } from './category-form'

export default async function ExpenseCategoriesPage() {
  const categories = await getExpenseCategories()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Expense Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage categories for your operating expenses.</p>
        </div>
        <CategoryForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>All expense classifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No expense categories found.
                  </TableCell>
                </TableRow>
              )}
              {categories?.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{cat.description || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
