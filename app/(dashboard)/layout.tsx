import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getUserProfile } from '@/lib/auth-utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { OrganizationProvider } from '@/components/providers/organization-provider'
import { ExpensiveAmbientMesh } from '@/components/expensive-ambient-mesh'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const profile = await getUserProfile()
  const supabase = await createClient()

  let organization = null
  if (profile?.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single()
    organization = data
  }
  
  return (
    <TooltipProvider>
      <OrganizationProvider initialOrganization={organization}>
        <SidebarProvider>
          <AppSidebar role={profile?.role || 'employee'} />
          <main className="relative flex-1 overflow-hidden flex flex-col bg-background/95 transition-colors">
            {/* Ultra-Luxury Ambient Gradient Aurora & Precision Grid */}
            <ExpensiveAmbientMesh />

            {/* Frosted Glass Floating Header */}
            <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-background/60 backdrop-blur-xl sticky top-0 z-20 transition-colors">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
              </div>
              <div className="flex items-center gap-3">
                {profile && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{profile.full_name}</span>
                    <Badge variant="outline" className="capitalize text-[10px] py-0 h-5 border-primary/20 bg-primary/5">
                      {profile.role}
                    </Badge>
                  </div>
                )}
                <ThemeToggle />
              </div>
            </header>

            {/* Main Content Area */}
            <div className="relative z-10 flex-1 overflow-auto p-4 md:p-6">
              {children}
            </div>
          </main>
        </SidebarProvider>
      </OrganizationProvider>
    </TooltipProvider>
  )
}
