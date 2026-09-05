'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile, checkAccess } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
  const profile = await getUserProfile()
  if (!profile) return []

  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name, email),
      created_by_profile:profiles!tasks_created_by_fkey(id, full_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (profile.role === 'employee') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  return data || []
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
  } catch {
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
  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteTask(taskId: string) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch {
    return { error: 'Unauthorized to delete tasks' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath('/tasks')
  return { success: true }
}
