'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { payPayroll } from '@/app/actions/payroll'

export function PayButton({ payrollId }: { payrollId: string }) {
  const [pending, setPending] = useState(false)

  async function handlePay() {
    setPending(true)
    const result = await payPayroll(payrollId)
    setPending(false)
    if (result?.error) {
      alert(`Error: ${result.error}`)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePay} disabled={pending}>
      {pending ? 'Processing...' : 'Mark as Paid'}
    </Button>
  )
}
