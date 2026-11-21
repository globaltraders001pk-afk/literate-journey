'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfile, ORGANIZATION_PUBLIC_COLUMNS } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function getPublicBrand() {
  try {
    const admin = createAdminClient()
    // Deterministic order (QA audit M19): without one, a
    // multi-tenant DB returns whichever org row PostgREST picks
    // first. The seeded org is the oldest, so first-created wins.
    // Only the two columns the login brand needs — never the
    // full row (which holds the backend-only fbr_token).
    const { data } = await admin
      .from('organizations')
      .select('name, logo_url')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data || { name: 'Global Traders', logo_url: null }
  } catch {
    return { name: 'Global Traders', logo_url: null }
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
    .select(ORGANIZATION_PUBLIC_COLUMNS)
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
    .select(ORGANIZATION_PUBLIC_COLUMNS)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { success: true, organization: data }
}

export async function updateFbrSettings(formData: FormData) {
  const profile = await getUserProfile()

  if (!profile) {
    return { error: 'Unauthorized. Please sign in.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'admin') {
    return { error: 'Forbidden: Only the business owner or an admin can change FBR / invoice settings.' }
  }

  if (!profile.organization_id) {
    return { error: 'No organization linked to this account.' }
  }

  const ntn = (formData.get('ntn') as string)?.trim()
  const fbr_token = (formData.get('fbr_token') as string)?.trim()
  // Invoice prefix: uppercase letters/digits/hyphen only, max 10 chars. Defaults to GT-226.
  const rawPrefix = (formData.get('invoice_prefix') as string)?.trim().toUpperCase() || 'GT-226'
  const invoice_prefix = rawPrefix.replace(/[^A-Z0-9-]/g, '').slice(0, 10) || 'GT-226'
  const bank_name = (formData.get('bank_name') as string)?.trim()
  const bank_iban = (formData.get('bank_iban') as string)?.trim()
  const dispatch_text = (formData.get('dispatch_text') as string)?.trim()
  // Payment terms in days (0 = due immediately), clamped 0–365, default 10.
  const rawTerms = parseInt((formData.get('payment_terms_days') as string) || '', 10)
  const payment_terms_days = Number.isFinite(rawTerms) ? Math.min(365, Math.max(0, rawTerms)) : 10
  // GST rate in percent, clamped 0–100, default 18.
  const rawGst = parseFloat((formData.get('gst_rate') as string) || '')
  const gst_rate = Number.isFinite(rawGst) ? Math.min(100, Math.max(0, rawGst)) : 18

  const supabase = await createClient()

  // NOTE: ntn / fbr_token / invoice_prefix / bank_name / bank_iban /
  // dispatch_text / payment_terms_days / gst_rate live ONLY in the
  // organizations row in the database (see
  // ~/workspace/your_files/fbr-invoice-v2-delta.sql). They are never
  // hardcoded in source. Run that SQL on the live Supabase DB before
  // saving here, otherwise this update fails with a "column does not
  // exist" error. barcode_value is GONE — the client's sample invoice
  // forbids both the barcode and the FBR token on the printed invoice,
  // so the field is dead and was removed (v2 delta, Nov 2026).
  // fbr_token stays backend-only: it is stored here, never rendered
  // on any invoice — and never sent back to the browser either (the
  // settings form never receives the stored token, so an empty token
  // field means "keep what is stored", NOT "clear it").
  const updates: {
    ntn: string | null
    invoice_prefix: string
    bank_name: string | null
    bank_iban: string | null
    dispatch_text: string | null
    payment_terms_days: number
    gst_rate: number
    fbr_token?: string
  } = {
    ntn: ntn || null,
    invoice_prefix,
    bank_name: bank_name || null,
    bank_iban: bank_iban || null,
    dispatch_text: dispatch_text || null,
    payment_terms_days,
    gst_rate,
  }
  if (fbr_token) {
    updates.fbr_token = fbr_token
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', profile.organization_id)
    .select(ORGANIZATION_PUBLIC_COLUMNS)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
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

  // SVG and GIF are not allowed (QA audit M20): an SVG served
  // from the public bucket can carry script, and GIF is not
  // needed for a logo. Only raster formats browsers render as
  // inert images.
  const allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ]

  if (!allowedMimeTypes.includes(file.type)) {
    return { error: 'Invalid file format. Only PNG, JPG, and WEBP are supported.' }
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
      .select(ORGANIZATION_PUBLIC_COLUMNS)
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
    .select(ORGANIZATION_PUBLIC_COLUMNS)
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
    .select(ORGANIZATION_PUBLIC_COLUMNS)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { success: true, organization: updatedOrg }
}
