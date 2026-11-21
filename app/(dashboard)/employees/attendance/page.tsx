import { getEmployees, getAttendance, getEmployeeAttendanceHistory } from '@/app/actions/employees'
import { getUserProfile } from '@/lib/auth-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AttendanceForm } from './attendance-form'
import { truncationNote } from '@/lib/pagination'
import { CalendarCheck, Clock, UserCheck } from 'lucide-react'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const date = params.date || today

  const [{ rows: employees, total: employeesTotal }, attendance, profile] = await Promise.all([
    getEmployees(),
    getAttendance(date),
    getUserProfile()
  ])
  const employeesNote = truncationNote(employeesTotal, employees.length, 'employees')

  const isEmployee = profile?.role === 'employee'

  // Map attendance by employee ID for quick lookup
  const attendanceMap = new Map()
  attendance?.forEach(record => {
    attendanceMap.set(record.employee_id, record.status)
  })

  // Employee Self-Service View
  if (isEmployee) {
    const myEmployee = employees?.find(e => e.profile_id === profile?.id || (profile?.email && e.email === profile.email))
    const history = myEmployee ? await getEmployeeAttendanceHistory(myEmployee.id) : []
    const todayStatus = myEmployee ? attendanceMap.get(myEmployee.id) : null

    const presentCount = history?.filter(h => h.status === 'present').length || 0
    const absentCount = history?.filter(h => h.status === 'absent').length || 0
    const leaveCount = history?.filter(h => h.status === 'on_leave').length || 0

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">My Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View your daily attendance records and history.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Today's Status</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {todayStatus ? (
                <Badge variant={todayStatus === 'present' ? 'default' : todayStatus === 'absent' ? 'destructive' : 'secondary'} className="text-sm">
                  {todayStatus.toUpperCase().replace('_', ' ')}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground font-medium">Pending Manager Check-in</span>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">Date: {today}</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Days Present (Last 30)</CardTitle>
              <CalendarCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{presentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Confirmed working days</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Absences & Leave</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{absentCount + leaveCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{leaveCount} approved leave, {absentCount} absent</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>Your personal attendance log for the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No attendance logged yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  history?.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.date}</TableCell>
                      <TableCell>
                        <Badge variant={rec.status === 'present' ? 'default' : rec.status === 'absent' ? 'destructive' : 'secondary'}>
                          {rec.status.toUpperCase().replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{rec.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Manager & Owner Full Roster View
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Staff Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Log and manage daily attendance for all team members.</p>
        </div>
        <div className="text-sm font-medium border rounded-md px-3 py-1.5">
          Date: {date}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Roster</CardTitle>
          <CardDescription>Mark attendance status for {date}</CardDescription>
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
              {employees?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No employees found. Add employees first.
                  </TableCell>
                </TableRow>
              )}
              {employees?.map((emp) => {
                const status = attendanceMap.get(emp.id)
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                    <TableCell>{emp.role}</TableCell>
                    <TableCell>
                      {status ? (
                        <Badge variant={status === 'present' ? 'default' : status === 'absent' ? 'destructive' : 'secondary'}>
                          {status.toUpperCase().replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not Marked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AttendanceForm employeeId={emp.id} date={date} currentStatus={status || ''} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {employeesNote && (
            <p className="text-xs text-muted-foreground mt-3">{employeesNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
