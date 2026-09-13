import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus } from 'lucide-react'

export default function EmployeesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your staff and payroll details.</p>
        </div>
        <div className="h-9 px-4 rounded-md bg-primary/20 text-primary flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" />
          <span>Add Employee</span>
        </div>
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
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32 rounded font-medium" /></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-3 w-16 rounded-full" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-24 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
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
