import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getUserProfile } from '@/lib/auth-utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const profile = await getUserProfile()
  
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar role={profile?.role || 'employee'} />
        <main className="flex-1 overflow-hidden flex flex-col bg-muted/20">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 transition-colors">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-3">
              {profile && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{profile.full_name}</span>
                  <Badge variant="outline" className="capitalize text-[10px] py-0 h-5">
                    {profile.role}
                  </Badge>
                </div>
              )}
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}
