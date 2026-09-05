'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { markAttendance } from '@/app/actions/employees'

export function AttendanceForm({ employeeId, date, currentStatus }: { employeeId: string, date: string, currentStatus: string }) {
  const [pending, setPending] = useState(false)

  async function handleStatusChange(status: string | null) {
    if (!status) return
    setPending(true)
    await markAttendance(employeeId, date, status)
    setPending(false)
  }

  return (
    <div className="w-[180px]">
      <Select value={currentStatus} onValueChange={handleStatusChange} disabled={pending}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Mark Status..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="present">Present</SelectItem>
          <SelectItem value="absent">Absent</SelectItem>
          <SelectItem value="half_day">Half Day</SelectItem>
          <SelectItem value="leave">Leave</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
