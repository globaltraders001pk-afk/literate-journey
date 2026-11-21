'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

import { checkAccess } from '@/lib/auth-utils'

function validatePeriod(month: number, year: number): string | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'Month must be between 1 and 12'
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return 'Year must be between 2000 and 2100'
  return null
}

export async function generatePayroll(month: number, year: number) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Unauthorized' } }

  const periodError = validatePeriod(month, year)
  if (periodError) return { error: periodError }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  // 1. Get all active employees
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)

  if (!employees || employees.length === 0) return { error: 'No active employees to generate payroll for' }

  // 2. Never touch rows that are already paid. Re-running generation
  // for a month used to reset paid rows back to draft at full salary;
  // now only new rows and still-draft rows are (re)created, so
  // generating twice is safe.
  const { data: existing, error: existingError } = await supabase
    .from('payroll')
    .select('employee_id, status')
    .eq('organization_id', profile.organization_id)
    .eq('month', month)
    .eq('year', year)

  if (existingError) return { error: existingError.message }

  const paidEmployeeIds = new Set(
    (existing || []).filter((row) => row.status === 'paid').map((row) => row.employee_id)
  )

  const payrollEntries = employees
    .filter((emp) => !paidEmployeeIds.has(emp.id))
    .map(emp => ({
      organization_id: profile.organization_id,
      employee_id: emp.id,
      month,
      year,
      basic_salary: emp.base_salary,
      deductions: 0,
      bonuses: 0,
      net_salary: emp.base_salary,
      status: 'draft'
    }))

  if (payrollEntries.length === 0) {
    return { success: true, message: 'Payroll for this month is already paid for all active employees.' }
  }

  // 3. Batch upsert payroll records for all employees in a single query.
  // The conflict target must match the unique index exactly —
  // (organization_id, employee_id, month, year) — or PostgREST
  // rejects the upsert at runtime.
  const { error: upsertError } = await supabase
    .from('payroll')
    .upsert(payrollEntries, { onConflict: 'organization_id,employee_id,month,year' })

  if (upsertError) return { error: upsertError.message }

  revalidatePath('/employees/payroll')
  return { success: true }
}

export async function getPayroll(month: number, year: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll')
    .select('*, employees(first_name, last_name, role)')
    .eq('month', month)
    .eq('year', year)
  
  if (error) throw new Error(error.message)
  return data
}

export async function payPayroll(payrollId: string) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Unauthorized' } }

  if (!payrollId) return { error: 'Payroll record is required' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  // Only a draft row in the caller's own org can be marked paid.
  // Selecting the id back lets us tell a real pay apart from a no-op
  // (already paid, wrong org, or unknown id), which used to report
  // success silently.
  const { data, error } = await supabase
    .from('payroll')
    .update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] })
    .eq('id', payrollId)
    .eq('organization_id', profile.organization_id)
    .eq('status', 'draft')
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Payroll record not found, already paid, or not in your organization.' }
  }

  revalidatePath('/employees/payroll')
  return { success: true }
}
