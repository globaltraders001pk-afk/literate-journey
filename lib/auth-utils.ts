import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'owner' | 'admin' | 'manager' | 'employee'

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
    .select('*')
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
