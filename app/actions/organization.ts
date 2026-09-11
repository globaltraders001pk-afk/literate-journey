'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfile } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function getPublicBrand() {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('organizations')
      .select('name, logo_url')
      .limit(1)
      .maybeSingle()
    return data || { name: 'Qurbat ERP', logo_url: null }
  } catch {
    return { name: 'Qurbat ERP', logo_url: null }
  }
}

export async function getOrganization() {
  const profile = await getUserProfile()
  if (!profile || !profile.organization_id) {
    return { organization: null, error: 'Unauthorized or no organization' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single()

  if (error) {
    return { organization: null, error: error.message }
  }

  return { organization: data, error: null }
}

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

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    })
    .eq('id', profile.organization_id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { success: true, organization: data }
}

export async function uploadOrganizationLogo(formData: FormData) {
  const profile = await getUserProfile()

  if (!profile) {
    return { error: 'Unauthorized. Please sign in.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Forbidden: Only the business owner can change the organization logo.' }
  }

  if (!profile.organization_id) {
    return { error: 'No organization linked to this account.' }
  }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) {
    return { error: 'No image file provided.' }
  }

  // Max 5MB
  const maxBytes = 5 * 1024 * 1024
  if (file.size > maxBytes) {
    return { error: 'File size exceeds 5MB limit. Please upload a smaller image.' }
  }

  const allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml',
    'image/gif',
  ]

  if (!allowedMimeTypes.includes(file.type)) {
    return { error: 'Invalid file format. Only PNG, JPG, WEBP, SVG, and GIF are supported.' }
  }

  try {
    const adminSupabase = createAdminClient()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const fileName = `logos/org-${profile.organization_id}-${Date.now()}.${extension}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await adminSupabase.storage
      .from('organization-assets')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return { error: `Failed to upload logo: ${uploadError.message}` }
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from('organization-assets')
      .getPublicUrl(fileName)

    const logoUrl = publicUrlData.publicUrl

    // Update organizations table
    const { data: updatedOrg, error: dbError } = await adminSupabase
      .from('organizations')
      .update({ logo_url: logoUrl })
      .eq('id', profile.organization_id)
      .select()
      .single()

    if (dbError) {
      return { error: `Failed to save logo to database: ${dbError.message}` }
    }

    revalidatePath('/settings')
    revalidatePath('/', 'layout')

    return { success: true, logo_url: logoUrl, organization: updatedOrg }
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred during logo upload.' }
  }
}

export async function updateOrganizationLogoUrl(logoUrl: string) {
  const profile = await getUserProfile()

  if (!profile) {
    return { error: 'Unauthorized. Please sign in.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Forbidden: Only the business owner can change the organization logo.' }
  }

  if (!profile.organization_id) {
    return { error: 'No organization linked to this account.' }
  }

  const trimmedUrl = logoUrl?.trim()
  if (!trimmedUrl) {
    return { error: 'Logo URL cannot be empty.' }
  }

  const supabase = await createClient()
  const { data: updatedOrg, error } = await supabase
    .from('organizations')
    .update({ logo_url: trimmedUrl })
    .eq('id', profile.organization_id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { success: true, logo_url: trimmedUrl, organization: updatedOrg }
}

export async function removeOrganizationLogo() {
  const profile = await getUserProfile()

  if (!profile) {
    return { error: 'Unauthorized. Please sign in.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Forbidden: Only the business owner can remove the organization logo.' }
  }

  if (!profile.organization_id) {
    return { error: 'No organization linked to this account.' }
  }

  const supabase = await createClient()
  const { data: updatedOrg, error } = await supabase
    .from('organizations')
    .update({ logo_url: null })
    .eq('id', profile.organization_id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { success: true, organization: updatedOrg }
}
