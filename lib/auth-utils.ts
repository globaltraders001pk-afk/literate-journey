import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'owner' | 'admin' | 'manager' | 'employee'

// Columns of `organizations` that are safe to send to the browser.
// fbr_token is deliberately NOT in this list: it is a backend-only
// credential, stored in the DB and never rendered or printed anywhere.
// barcode_value is dead (the client sample forbids it on the invoice).
// Every organizations read that reaches a client component must use
// this list instead of select('*') — see QA audit H1 (2026-11-20).
export const ORGANIZATION_PUBLIC_COLUMNS =
  'id, name, phone, email, address, logo_url, ntn, invoice_prefix, bank_name, bank_iban, dispatch_text, payment_terms_days, gst_rate, created_at'

export const getUserProfile = cache(async () => {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  
  if (!userData.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, organization_id, full_name, email')
    .eq('id', userData.user.id)
    .single()

  return profile as { id: string; role: UserRole; organization_id: string; full_name: string; email?: string } | null
})

export const getOrganization = cache(async (organizationId: string) => {
  if (!organizationId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select(ORGANIZATION_PUBLIC_COLUMNS)
    .eq('id', organizationId)
    .single()
  return data
})

export async function checkAccess(allowedRoles: UserRole[]) {
  const profile = await getUserProfile()
  
  if (!profile) {
    redirect('/login')
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect('/dashboard?error=unauthorized')
  }

  return profile
}
