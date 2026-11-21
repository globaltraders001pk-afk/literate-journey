'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkAccess } from '@/lib/auth-utils'

export async function getExpenseCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createExpenseCategory(formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Unauthorized' } }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  
  if (!name) return { error: 'Name is required' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  const { error } = await supabase
    .from('expense_categories')
    .insert({
      organization_id: profile.organization_id,
      name,
      description
    })

  if (error) return { error: error.message }
  
  revalidatePath('/expenses/categories')
  return { success: true }
}

export async function deleteExpenseCategory(id: string) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Unauthorized' } }

  const supabase = await createClient()

  // Refuse while any expense still uses the category, so the ledger
  // never ends up pointing at a deleted classification.
  const { count, error: countError } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (countError) return { error: countError.message }
  if (count && count > 0) {
    return { error: `Cannot delete this category — it is still used by ${count} expense${count === 1 ? '' : 's'}. Move those expenses to another category first.` }
  }

  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/expenses/categories')
  return { success: true }
}

export async function getExpenses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      expense_categories(name),
      profiles(full_name)
    `)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createExpense(formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch { return { error: 'Unauthorized' } }

  const category_id = formData.get('category_id') as string
  const amount = parseFloat(formData.get('amount') as string)
  const expense_date = formData.get('expense_date') as string
  const reference_number = formData.get('reference_number') as string
  const notes = formData.get('notes') as string

  if (!category_id || !amount || !expense_date) return { error: 'Required fields missing' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()

  if (!branch) return { error: 'No branch found' }

  const { error } = await supabase
    .from('expenses')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      category_id,
      amount,
      expense_date,
      reference_number,
      notes,
      created_by: profile.id
    })

  if (error) return { error: error.message }
  
  revalidatePath('/expenses/ledger')
  return { success: true }
}
