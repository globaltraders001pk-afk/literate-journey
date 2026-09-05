'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function updateOrganization(formData: FormData) {
  const profile = await getUserProfile()
  
  if (!profile) {
    return { error: 'Unauthorized. Please sign in.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Forbidden: Only the business owner can modify organization settings.' }
  }

  if (!profile.organization_id) {
    return { error: 'No organization linked to this account.' }
  }

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const address = (formData.get('address') as string)?.trim()

  if (!name) {
    return { error: 'Business name is required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    })
    .eq('id', profile.organization_id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}
