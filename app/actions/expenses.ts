'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkAccess, getUserProfile } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { emptyToUndefined, expenseSchema, firstZodError } from '@/lib/validation'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

export async function getExpenseCategories() {
  const profile = await getUserProfile()
  if (!profile) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('name', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createExpenseCategory(formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

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

export async function updateExpenseCategory(id: string, formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) return { error: 'Name is required' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .update({ name, description })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Category not found in your organization.' }

  revalidatePath('/expenses/categories')
  return { success: true }
}

export async function deleteExpenseCategory(id: string) {
  try { await checkAccess(['admin', 'owner']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Refuse while any expense still uses the category, so the ledger
  // never ends up pointing at a deleted classification. Scoped to
  // the caller's org, like the delete itself (H12 pattern).
  const { count, error: countError } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('category_id', id)

  if (countError) return { error: countError.message }
  if (count && count > 0) {
    return { error: `Cannot delete this category — it is still used by ${count} expense${count === 1 ? '' : 's'}. Move those expenses to another category first.` }
  }

  const { data, error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Category not found in your organization.' }

  revalidatePath('/expenses/categories')
  return { success: true }
}

export async function getExpenses(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('expenses')
    .select(`
      *,
      expense_categories(name),
      profiles(full_name)
    `, { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function createExpense(formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  // A negative amount used to pass: `!amount` is false for -5.
  // zod rejects negatives, NaN and non-numbers up front.
  const parsed = expenseSchema.safeParse({
    category_id: formData.get('category_id'),
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date'),
    reference_number: emptyToUndefined(formData.get('reference_number')),
    notes: emptyToUndefined(formData.get('notes')),
  })
  if (!parsed.success) return { error: firstZodError(parsed) }
  const { category_id, amount, expense_date, reference_number, notes } = parsed.data

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

export async function updateExpense(id: string, formData: FormData) {
  try { await checkAccess(['admin', 'owner']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  // Same validation as create: zod rejects negatives, NaN and non-numbers.
  const parsed = expenseSchema.safeParse({
    category_id: formData.get('category_id'),
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date'),
    reference_number: emptyToUndefined(formData.get('reference_number')),
    notes: emptyToUndefined(formData.get('notes')),
  })
  if (!parsed.success) return { error: firstZodError(parsed) }
  const { category_id, amount, expense_date, reference_number, notes } = parsed.data

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Ownership first: the expense must belong to the caller's org.
  const { data: existing } = await supabase
    .from('expenses')
    .select('id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()
  if (!existing) return { error: 'Expense not found in your organization.' }

  // The new category must also belong to the caller's org, so an
  // expense can never be moved into another organization's category.
  const { data: category } = await supabase
    .from('expense_categories')
    .select('id')
    .eq('id', category_id)
    .eq('organization_id', profile.organization_id)
    .single()
  if (!category) return { error: 'Category not found in your organization.' }

  const { error } = await supabase
    .from('expenses')
    .update({ category_id, amount, expense_date, reference_number, notes })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: error.message }

  // The ledger shows the edit; the cashflow breakdown aggregates by
  // category, so it changes too.
  revalidatePath('/expenses/ledger')
  revalidatePath('/expenses/cashflow')
  return { success: true }
}
