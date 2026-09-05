'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function getVendors() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createVendor(formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch {
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
  } catch {
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

  const supabase = await createClient()

  const { error } = await supabase
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

  if (error) return { error: error.message }
  
  revalidatePath('/purchases/vendors')
  return { success: true }
}

export async function getVendorOrders(vendorId: string) {
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
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching vendor orders:', error)
    return []
  }
  return data || []
}
