import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function AttendanceLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Staff Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Log and manage daily attendance for all team members.</p>
        </div>
        <div className="text-sm font-medium border rounded-md px-3 py-1.5 flex items-center gap-1.5 bg-muted/20">
          <span>Date:</span>
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Roster</CardTitle>
          <CardDescription>Mark attendance status for today</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>Update Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32 rounded font-medium" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-24 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-28 rounded-md" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
