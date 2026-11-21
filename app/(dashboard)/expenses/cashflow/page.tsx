import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'
import { formatPKR } from '@/lib/format-currency'

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string, year?: string }>
}) {
  const params = await searchParams
  const date = new Date()
  const month = params.month ? parseInt(params.month) : date.getMonth() + 1
  const year = params.year ? parseInt(params.year) : date.getFullYear()

  const supabase = await createClient()

  // 1. Get Income (Sales)
  const { data: sales } = await supabase
    .from('sales')
    .select('total_amount')
    .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)
    .lt('created_at', month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`)

  const totalIncome = sales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

  // 2. Get Expenses (Operations)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .gte('expense_date', `${year}-${month.toString().padStart(2, '0')}-01`)
    .lt('expense_date', month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`)
    
  const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

  // 3. Get Payroll
  const { data: payroll } = await supabase
    .from('payroll')
    .select('net_salary')
    .eq('month', month)
    .eq('year', year)
    .eq('status', 'paid')

  const totalPayroll = payroll?.reduce((sum, p) => sum + Number(p.net_salary), 0) || 0

  const totalOutflow = totalExpenses + totalPayroll
  const netProfit = totalIncome - totalOutflow

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">P&L / Cash Flow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Financial summary for {month}/{year}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income (Sales)</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatPKR(totalIncome)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outflow (Expenses + Payroll)</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">{formatPKR(totalOutflow)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatPKR(netProfit)}
            </div>
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
              {expenses?.map((exp: any, idx: number) => {
                const catName = Array.isArray(exp.expense_categories) ? exp.expense_categories[0]?.name : exp.expense_categories?.name
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{catName || 'Uncategorized'}</TableCell>
                    <TableCell className="text-right text-destructive font-mono">{formatPKR(exp.amount)}</TableCell>
                  </TableRow>
                )
              })}
              <TableRow>
                <TableCell className="font-medium">Payroll (Paid)</TableCell>
                <TableCell className="text-right text-destructive font-semibold font-mono">{formatPKR(totalPayroll)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
