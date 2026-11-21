'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess, getUserProfile } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

export async function getVendors(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function createVendor(formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to add vendors' }
  }

  const name = formData.get('name') as string
  const contact_person = formData.get('contact_person') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const items_supplied = formData.get('items_supplied') as string
  const rates = formData.get('rates') as string

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
    .from('vendors')
    .insert({
      organization_id: profile.organization_id,
      name,
      contact_person,
      email,
      phone,
      address,
      items_supplied: items_supplied || null,
      rates: rates || null
    })

  if (error) return { error: error.message }
  
  revalidatePath('/purchases/vendors')
  return { success: true }
}

export async function updateVendor(id: string, formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to edit vendors' }
  }

  const name = formData.get('name') as string
  const contact_person = formData.get('contact_person') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const items_supplied = formData.get('items_supplied') as string
  const rates = formData.get('rates') as string

  if (!name) return { error: 'Name is required' }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Org-scoped (QA audit H12): zero matched rows means unknown id
  // or another org's vendor.
  const { data, error } = await supabase
    .from('vendors')
    .update({
      name,
      contact_person,
      email,
      phone,
      address,
      items_supplied: items_supplied || null,
      rates: rates || null
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Vendor not found in your organization.' }
  
  revalidatePath('/purchases/vendors')
  return { success: true }
}

export async function getVendorOrders(vendorId: string) {
  const profile = await getUserProfile()
  if (!profile) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      purchase_order_items (
        *,
        products (name, sku)
      )
    `)
    .eq('organization_id', profile.organization_id)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching vendor orders:', error)
    return []
  }
  return data || []
}
