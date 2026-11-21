'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile, checkAccess } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

// Task statuses used anywhere in the app: the task page select
// (pending / in_progress / completed), the AI tool description,
// and the dashboard's quick-complete button, which marks 'DONE'.
// Anything else is rejected, never stored raw.
const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'DONE']

export async function getTasks(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)

  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name, email),
      created_by_profile:profiles!tasks_created_by_fkey(id, full_name)
    `, { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (profile.role === 'employee') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('Error fetching tasks:', error)
    return { rows: [], total: 0, limit, offset }
  }
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function getAssignees() {
  const profile = await getUserProfile()
  if (!profile) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('organization_id', profile.organization_id)
    .order('full_name', { ascending: true })

  if (error) return []
  return data || []
}

export async function createTask(formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to assign tasks' }
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const assigned_to = formData.get('assigned_to') as string
  const priority = formData.get('priority') as string || 'medium'
  const due_date = formData.get('due_date') as string

  if (!title) return { error: 'Task title is required' }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Profile not found' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .insert({
      organization_id: profile.organization_id,
      title,
      description: description || null,
      assigned_to: assigned_to || null,
      priority,
      status: 'pending',
      due_date: due_date || null,
      created_by: profile.id
    })

  if (error) return { error: error.message }

  revalidatePath('/tasks')
  return { success: true }
}

export async function updateTaskStatus(taskId: string, status: string) {
  // Role gate (S6 sweep): any signed-in role may move a task's
  // status — the employee-only-their-own-tasks rule is enforced
  // in the query below, and stays the real guard.
  try { await checkAccess(['owner', 'admin', 'manager', 'employee']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  if (!TASK_STATUSES.includes(status)) return { error: 'Invalid task status' }

  const supabase = await createClient()
  // Org-scoped (QA audit M14/H12): the task must be in the caller's
  // org, and an employee may only touch tasks assigned to them —
  // the same rule getTasks already applies when listing.
  // Zero matched rows means unknown id, wrong org, or (for an
  // employee) someone else's task — never report success for it.
  let query = supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .eq('organization_id', profile.organization_id)

  if (profile.role === 'employee') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data, error } = await query.select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Task not found in your organization.' }
  }

  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteTask(taskId: string) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to delete tasks' }
  }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Task not found in your organization.' }
  }

  revalidatePath('/tasks')
  return { success: true }
}
