import { getEmployees } from '@/app/actions/employees'
import { checkAccess } from '@/lib/auth-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmployeeForm } from './employee-form'

export default async function EmployeesPage() {
  await checkAccess(['admin', 'owner', 'manager'])
  const employees = await getEmployees()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your staff and payroll details.</p>
        </div>
        <EmployeeForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
          <CardDescription>A list of all active employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
              {employees?.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{emp.role}</span>
                      {emp.profiles?.role === 'manager' && (
                        <Badge variant="outline" className="w-fit text-[10px] bg-primary/10 text-primary border-primary/30 py-0">
                          Manager Access
                        </Badge>
                      )}
                      {emp.profiles?.role === 'employee' && (
                        <Badge variant="outline" className="w-fit text-[10px] text-muted-foreground py-0">
                          Employee Access
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{emp.employment_type.replace('_', ' ')}</TableCell>
                  <TableCell>${emp.base_salary}</TableCell>
                  <TableCell>{emp.phone || '-'}</TableCell>
                  <TableCell>
                    {emp.is_active ? <Badge className="bg-emerald-500">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <EmployeeForm initialData={emp} />
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
