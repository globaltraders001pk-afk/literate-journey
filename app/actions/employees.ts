'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess, getUserProfile, type UserRole } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  emptyToUndefined,
  firstZodError,
} from '@/lib/validation'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

// Best-effort compensating delete for a half-created login (QA
// audit B8): if the profile or employee row fails after the Auth
// user was created, the Auth user must not be left orphaned with
// no profile / employee behind it. Failures here are swallowed
// on purpose — the original error is the one reported.
async function deleteCreatedAuthUser(userId: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    await createAdminClient().auth.admin.deleteUser(userId)
  } catch {
    // Nothing to do — the orphan is logged by the caller path.
  }
}

// QA audit H4: system roles are a closed list, and nobody may hand
// out a role above their own. Rank: employee < manager < admin < owner.
// (Only the owner sits at the top, so "above your own role" can only
// ever be granted by the owner — in practice any request above the
// caller's rank is refused here.)
const SYSTEM_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'employee']
const ROLE_RANK: Record<UserRole, number> = { employee: 0, manager: 1, admin: 2, owner: 3 }

function validateSystemRole(requested: string, callerRole: UserRole): string | null {
  if (!(SYSTEM_ROLES as string[]).includes(requested)) return 'Invalid system role'
  if (ROLE_RANK[requested as UserRole] > ROLE_RANK[callerRole]) {
    return 'Only the business owner can assign a role above your own.'
  }
  return null
}

export async function getEmployees(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('employees')
    .select(`
      *,
      profiles (
        id,
        role
      )
    `, { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('first_name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function createEmployee(formData: FormData) {
  let caller: { role: UserRole; organization_id: string }
  try { caller = await checkAccess(['admin', 'owner']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Only owners and administrators can add users and set salaries.' } }

  // Validate before touching anything: the old code computed
  // system_role from role.toLowerCase() BEFORE the required-field
  // check, so a form without a role crashed with a TypeError.
  const rawRole = (formData.get('role') as string) || ''
  const parsed = employeeCreateSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: emptyToUndefined(formData.get('email')),
    phone: emptyToUndefined(formData.get('phone')),
    role: rawRole,
    employment_type: emptyToUndefined(formData.get('employment_type')),
    base_salary: Number(formData.get('base_salary')),
    system_role: emptyToUndefined(formData.get('system_role')),
    create_login: formData.get('create_login') === 'on',
    password: emptyToUndefined(formData.get('password')),
  })
  if (!parsed.success) return { error: firstZodError(parsed) }
  const {
    first_name,
    last_name,
    email,
    phone,
    role,
    employment_type,
    base_salary,
  } = parsed.data

  const create_login = parsed.data.create_login
  const password = parsed.data.password
  const system_role =
    parsed.data.system_role ||
    (role.toLowerCase().includes('manager') ? 'manager' : 'employee')

  const systemRoleError = validateSystemRole(system_role, caller.role)
  if (systemRoleError) return { error: systemRoleError }
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

  // 1. Create Auth Account if requested. If any later step fails,
  // the Auth user is deleted again (compensating delete, QA audit
  // B8): the old code returned the error and left an Auth user
  // with no profile row and no employee row behind.
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
      if (!authData.user) return { error: 'Failed to create system login.' }
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

      if (profileError) {
        await deleteCreatedAuthUser(newProfileId)
        return { error: profileError.message }
      }
    } catch (err) {
      // A half-created login (Auth user made, profile insert
      // threw) is cleaned up too — never leave the orphan.
      if (newProfileId) await deleteCreatedAuthUser(newProfileId)
      return {
        error:
          err instanceof Error
            ? `Failed to create system login: ${err.message}`
            : 'Failed to create system login. Ensure SUPABASE_SERVICE_ROLE_KEY is set.',
      }
    }
  }

  // 2. Create Employee Record. If this fails after a login was
  // created, the profile row and the Auth user go away with it.
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

  if (error) {
    if (newProfileId) {
      await supabase.from('profiles').delete().eq('id', newProfileId)
      await deleteCreatedAuthUser(newProfileId)
    }
    return { error: error.message }
  }

  revalidatePath('/employees/list')
  return { success: true }
}

export async function updateEmployee(id: string, formData: FormData) {
  let caller: { role: UserRole; organization_id: string }
  try { caller = await checkAccess(['admin', 'owner', 'manager']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  const rawRole = (formData.get('role') as string) || ''
  const parsed = employeeUpdateSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: emptyToUndefined(formData.get('email')),
    phone: emptyToUndefined(formData.get('phone')),
    role: rawRole,
    employment_type: emptyToUndefined(formData.get('employment_type')),
    base_salary: Number(formData.get('base_salary')),
    system_role: emptyToUndefined(formData.get('system_role')),
    is_active: formData.get('is_active') === 'on',
  })
  if (!parsed.success) return { error: firstZodError(parsed) }
  const {
    first_name,
    last_name,
    email,
    phone,
    role,
    employment_type,
    base_salary,
    is_active,
  } = parsed.data
  const system_role = parsed.data.system_role

  const supabase = await createClient()

  // The target must be in the caller's org, and the role change
  // needs the target's CURRENT system role: the edit form always
  // submits system_role (defaulting to the current value), so a
  // manager re-saving an unchanged role is not "changing" it.
  const { data: target } = await supabase
    .from('employees')
    .select('profile_id, organization_id')
    .eq('id', id)
    .single()

  if (!target || target.organization_id !== caller.organization_id) {
    return { error: 'Employee not found in your organization.' }
  }

  let currentSystemRole: string | null = null
  if (target.profile_id) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', target.profile_id)
      .single()
    currentSystemRole = targetProfile?.role ?? null
  }

  if (system_role && currentSystemRole && system_role !== currentSystemRole) {
    // Managers may not change `role` at all; anyone else may only
    // set a role at or below their own (owner-only above).
    if (caller.role === 'manager') {
      return { error: 'Managers cannot change system access roles.' }
    }
    const systemRoleError = validateSystemRole(system_role, caller.role)
    if (systemRoleError) return { error: systemRoleError }
  } else if (system_role && !currentSystemRole) {
    const systemRoleError = validateSystemRole(system_role, caller.role)
    if (systemRoleError) return { error: systemRoleError }
  }

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
    .eq('organization_id', caller.organization_id)
    .select('profile_id')
    .single()

  if (error) return { error: error.message }
  if (!emp) return { error: 'Employee not found in your organization.' }
  
  // Update system access role in profiles if changed
  if (emp?.profile_id && system_role) {
    await supabase
      .from('profiles')
      .update({ role: system_role })
      .eq('id', emp.profile_id)
      .eq('organization_id', caller.organization_id)
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
  const profile = await getUserProfile()
  if (!profile) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('*, employees(first_name, last_name, role)')
    .eq('organization_id', profile.organization_id)
    .eq('date', date)
  
  if (error) throw new Error(error.message)
  return data
}

export async function getEmployeeAttendanceHistory(employee_id: string) {
  const profile = await getUserProfile()
  if (!profile) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('employee_id', employee_id)
    .order('date', { ascending: false })
    .limit(30)
  
  if (error) throw new Error(error.message)
  return data
}

// Attendance statuses used by the UI select and the AI tools enum
// (lib/ai/tools.ts). Anything else is rejected, never stored raw.
const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'leave']

export async function markAttendance(employee_id: string, date: string, status: string) {
  try { await checkAccess(['admin', 'owner', 'manager']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized to record attendance' } }

  if (!ATTENDANCE_STATUSES.includes(status)) return { error: 'Invalid attendance status' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  // The employee must belong to the caller's org (QA audit M14):
  // an unchecked employee_id could otherwise mark attendance for
  // another tenant's staff.
  const { data: employee } = await supabase
    .from('employees')
    .select('organization_id')
    .eq('id', employee_id)
    .single()

  if (!employee || employee.organization_id !== profile.organization_id) {
    return { error: 'Employee not found in your organization' }
  }

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
