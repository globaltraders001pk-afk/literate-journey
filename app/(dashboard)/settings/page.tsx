import { createClient } from '@/lib/supabase/server'
import { getUserProfile, ORGANIZATION_PUBLIC_COLUMNS } from '@/lib/auth-utils'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  let organization = null
  if (profile?.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select(ORGANIZATION_PUBLIC_COLUMNS)
      .eq('id', profile.organization_id)
      .single()
    organization = data
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your workspace appearance, preferences, and organization details.</p>
      </div>

      <SettingsClient 
        organization={organization} 
        isOwner={profile?.role === 'owner'} 
        canManageFbr={profile?.role === 'owner' || profile?.role === 'admin'} 
      />
    </div>
  )
}
