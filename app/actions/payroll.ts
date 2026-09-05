'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

import { checkAccess } from '@/lib/auth-utils'

export async function generatePayroll(month: number, year: number) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Unauthorized' } }
  
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

  // 2. Upsert payroll records for each employee
  for (const emp of employees) {
    const net_salary = emp.base_salary // In a real app, calculate deductions based on attendance
    
    await supabase.from('payroll').upsert({
      organization_id: profile.organization_id,
      employee_id: emp.id,
      month,
      year,
      basic_salary: emp.base_salary,
      deductions: 0,
      bonuses: 0,
      net_salary: net_salary,
      status: 'draft'
    }, { onConflict: 'employee_id,month,year' })
  }

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

  const supabase = await createClient()
  const { error } = await supabase
    .from('payroll')
    .update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] })
    .eq('id', payrollId)

  if (error) return { error: error.message }
  revalidatePath('/employees/payroll')
  return { success: true }
}
