'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { generatePayroll } from '@/app/actions/payroll'
import { Calculator } from 'lucide-react'

export function GeneratePayrollButton({ month, year }: { month: number, year: number }) {
  const [pending, setPending] = useState(false)

  async function handleGenerate() {
    if (!confirm(`Generate payroll for ${month}/${year}? This will create draft slips for all active employees.`)) return
    
    setPending(true)
    const result = await generatePayroll(month, year)
    setPending(false)
    
    if (result.error) {
      alert(`Error: ${result.error}`)
    }
  }

  return (
    <Button onClick={handleGenerate} disabled={pending}>
      <Calculator className="mr-2 h-4 w-4" />
      {pending ? 'Generating...' : 'Generate Payroll'}
    </Button>
  )
}
