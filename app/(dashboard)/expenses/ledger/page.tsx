import { getExpenses, getExpenseCategories } from '@/app/actions/expenses'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ExpenseForm } from './expense-form'
import { formatPKR } from '@/lib/format-currency'
import { truncationNote } from '@/lib/pagination'

export default async function ExpensesLedgerPage() {
  const [{ rows: expenses, total: expensesTotal }, categories] = await Promise.all([
    getExpenses(),
    getExpenseCategories()
  ])
  const expensesNote = truncationNote(expensesTotal, expenses.length, 'expenses')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Financial Ledger</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Log and view all organization expenses.</p>
        </div>
        <ExpenseForm categories={categories || []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses Log</CardTitle>
          <CardDescription>A chronological ledger of recorded expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Ref Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logged By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No expenses logged yet.
                  </TableCell>
                </TableRow>
              )}
              {expenses?.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium">{new Date(exp.expense_date).toLocaleDateString()}</TableCell>
                  <TableCell>{exp.expense_categories?.name}</TableCell>
                  <TableCell>{exp.reference_number || '-'}</TableCell>
                  <TableCell className="text-destructive font-semibold">{formatPKR(exp.amount)}</TableCell>
                  <TableCell>
                    {exp.status === 'approved' 
                      ? <Badge variant="default">Approved</Badge>
                      : <Badge variant="secondary" className="capitalize">{exp.status}</Badge>}
                  </TableCell>
                  <TableCell>{exp.profiles?.full_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {expensesNote && (
            <p className="text-xs text-muted-foreground mt-3">{expensesNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
