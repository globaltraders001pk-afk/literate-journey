import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'

export default function CashflowLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">P&L / Cash Flow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Financial summary</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income (Sales)</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outflow (Expenses + Payroll)</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28 rounded-md" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown</CardTitle>
          <CardDescription>Operating expenses categorized for the period.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-36 rounded font-medium" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 rounded ml-auto" /></TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Payroll (Paid)</TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 rounded ml-auto" /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
