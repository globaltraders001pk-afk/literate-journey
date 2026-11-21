import { getPayroll } from '@/app/actions/payroll'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { GeneratePayrollButton } from './generate-payroll-button'
import { PayButton } from './pay-button'

import { checkAccess } from '@/lib/auth-utils'
import { formatPKR } from '@/lib/format-currency'

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string, year?: string }>
}) {
  await checkAccess(['admin', 'owner'])
  
  const date = new Date()
  const params = await searchParams
  const month = params.month ? parseInt(params.month) : date.getMonth() + 1
  const year = params.year ? parseInt(params.year) : date.getFullYear()

  const payrolls = await getPayroll(month, year)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and process staff salaries.</p>
        </div>
        <GeneratePayrollButton month={month} year={year} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Register - {month}/{year}</CardTitle>
          <CardDescription>Salary calculations for the selected month.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No payroll data found for this month. Click &quot;Generate Payroll&quot; to begin.
                  </TableCell>
                </TableRow>
              )}
              {payrolls?.map((p: { id: string; basic_salary?: number | string | null; deductions?: number | string | null; net_salary?: number | string | null; status?: string | null; employees?: { first_name?: string | null; last_name?: string | null } | null }) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.employees?.first_name} {p.employees?.last_name}</TableCell>
                  <TableCell>{formatPKR(p.basic_salary)}</TableCell>
                  <TableCell className="text-destructive">-{formatPKR(p.deductions)}</TableCell>
                  <TableCell className="font-semibold text-foreground">{formatPKR(p.net_salary)}</TableCell>
                  <TableCell>
                    {p.status === 'paid' 
                      ? <Badge variant="default">PAID</Badge>
                      : <Badge variant="secondary">DRAFT</Badge>}
                  </TableCell>
                  <TableCell>
                    {p.status === 'draft' && <PayButton payrollId={p.id} />}
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
