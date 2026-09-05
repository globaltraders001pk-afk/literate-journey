'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function getEmployees() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      profiles (
        id,
        role
      )
    `)
    .order('first_name', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createEmployee(formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Only owners and administrators can add users and set salaries.' } }

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const role = formData.get('role') as string
  const employment_type = formData.get('employment_type') as string
  const base_salary = parseFloat(formData.get('base_salary') as string)
  
  const create_login = formData.get('create_login') === 'on'
  const password = formData.get('password') as string
  const system_role = (formData.get('system_role') as string) || (role.toLowerCase().includes('manager') ? 'manager' : 'employee')

  if (!first_name || !last_name || !role) return { error: 'Required fields missing' }
  if (create_login && (!email || !password)) return { error: 'Email and password required for system login' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }
  
  let { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()

  if (!branch) {
    const { data: newBranch, error: branchError } = await supabase
      .from('branches')
      .insert({ organization_id: profile.organization_id, name: 'Main Branch' })
      .select('id')
      .single()
      
    if (branchError) return { error: 'Failed to create default branch.' }
    branch = newBranch
  }

  let newProfileId = null
  
  // 1. Create Auth Account if requested
  if (create_login) {
    try {
      // Lazy load admin client to avoid failing if env var is missing during standard imports
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminAuth = createAdminClient().auth.admin
      
      const { data: authData, error: authError } = await adminAuth.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: `${first_name} ${last_name}`
        }
      })
      
      if (authError) return { error: authError.message }
      if (authData.user) {
        newProfileId = authData.user.id
        
        // Insert into profiles with explicit system_role ('manager' | 'employee')
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: newProfileId,
            organization_id: profile.organization_id,
            full_name: `${first_name} ${last_name}`,
            email: email,
            role: system_role
          })
          
        if (profileError) return { error: profileError.message }
      }
    } catch (err: any) {
      return { error: 'Failed to create system login. Ensure SUPABASE_SERVICE_ROLE_KEY is set.' }
    }
  }

  // 2. Create Employee Record
  const { error } = await supabase
    .from('employees')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      profile_id: newProfileId,
      first_name,
      last_name,
      email,
      phone,
      role,
      employment_type,
      base_salary
    })

  if (error) return { error: error.message }
  
  revalidatePath('/employees/list')
  return { success: true }
}

export async function updateEmployee(id: string, formData: FormData) {
  try { await checkAccess(['admin', 'owner', 'manager']) } catch { return { error: 'Unauthorized' } }

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const role = formData.get('role') as string
  const employment_type = formData.get('employment_type') as string
  const base_salary = parseFloat(formData.get('base_salary') as string)
  const is_active = formData.get('is_active') === 'on'
  const system_role = formData.get('system_role') as string

  if (!first_name || !last_name || !role) return { error: 'Required fields missing' }

  const supabase = await createClient()

  const { data: emp, error } = await supabase
    .from('employees')
    .update({
      first_name,
      last_name,
      email,
      phone,
      role,
      employment_type,
      base_salary,
      is_active
    })
    .eq('id', id)
    .select('profile_id')
    .single()

  if (error) return { error: error.message }
  
  // Update system access role in profiles if changed
  if (emp?.profile_id && system_role) {
    await supabase
      .from('profiles')
      .update({ role: system_role })
      .eq('id', emp.profile_id)
  }

  // Manage Supabase Auth Login Access
  if (emp?.profile_id) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminAuth = createAdminClient().auth.admin
      // ban_duration can be 'none' to unban, or a duration like '876000h' for 100 years
      await adminAuth.updateUserById(emp.profile_id, {
        ban_duration: is_active ? 'none' : '876000h'
      })
    } catch (err) {
      console.error('Failed to update auth status for employee', err)
      // We don't return error here because the employee record was still updated successfully
    }
  }
  
  revalidatePath('/employees/list')
  return { success: true }
}

export async function getAttendance(date: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('*, employees(first_name, last_name, role)')
    .eq('date', date)
  
  if (error) throw new Error(error.message)
  return data
}

export async function getEmployeeAttendanceHistory(employee_id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employee_id)
    .order('date', { ascending: false })
    .limit(30)
  
  if (error) throw new Error(error.message)
  return data
}

export async function markAttendance(employee_id: string, date: string, status: string) {
  try { await checkAccess(['admin', 'owner', 'manager']) } catch { return { error: 'Unauthorized to record attendance' } }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  // Upsert attendance record
  const { error } = await supabase
    .from('attendance')
    .upsert({
      organization_id: profile.organization_id,
      employee_id,
      date,
      status
    }, { onConflict: 'employee_id,date' })

  if (error) return { error: error.message }
  
  revalidatePath('/employees/attendance')
  return { success: true }
}
