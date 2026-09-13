import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function PayrollLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and process staff salaries.</p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center text-sm font-medium">
          <span>Generate Payroll</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Register</CardTitle>
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
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32 rounded font-medium" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded font-semibold" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 rounded-md" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
