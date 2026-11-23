'use client'

import * as React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { Home, Package, ShoppingCart, Users, Settings, LogOut, DollarSign, ArrowLeftRight, Store, BarChart3, ListTodo, Sparkles, Plus, Clock, MessageSquare, Trash2, Radar } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { UserRole } from '@/lib/auth-utils'
import { ThemeToggleQuick } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getChatSessions, deleteChatSession, ChatSession } from '@/lib/ai/chat-storage'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/components/providers/organization-provider'

export function AppSidebar({ role }: { role: UserRole }) {
  const { organization } = useOrganization()
  const pathname = usePathname()
  const router = useRouter()
  const isEmployee = role === 'employee'
  const isAdmin = role === 'admin' || role === 'owner'

  const [recentChats, setRecentChats] = React.useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (role !== 'owner') return

    const updateFromStorage = () => {
      setRecentChats(getChatSessions())
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        setCurrentSessionId(params.get('session'))
      }
    }

    updateFromStorage()

    window.addEventListener('qurbat-chats-changed', updateFromStorage)
    window.addEventListener('popstate', updateFromStorage)
    window.addEventListener('storage', updateFromStorage)

    return () => {
      window.removeEventListener('qurbat-chats-changed', updateFromStorage)
      window.removeEventListener('popstate', updateFromStorage)
      window.removeEventListener('storage', updateFromStorage)
    }
  }, [role, pathname])

  const isExact = (path: string) => pathname === path || pathname === `${path}/`
  const isPrefix = (prefix: string) => pathname.startsWith(prefix)

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center border-b px-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden group">
          {organization?.logo_url ? (
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/60 bg-muted/20 flex items-center justify-center shrink-0">
              <Image
                src={organization.logo_url}
                alt={organization.name || 'Brand Logo'}
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
              <Store className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold text-base tracking-tight text-sidebar-foreground truncate group-hover:text-white transition-colors">
            {organization?.name || 'Qurbat ERP'}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="mt-4 px-2 space-y-1">
          
          <SidebarMenuItem>
            <SidebarMenuButton 
              render={<Link href="/dashboard" />} 
              tooltip="Dashboard"
              isActive={isExact('/dashboard')}
            >
              <Home /><span>Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {role === 'owner' && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                render={<Link href="/chat" />} 
                tooltip="AI Chat (Owner)"
                isActive={isPrefix('/chat') && !currentSessionId}
                className="text-blue-600 dark:text-blue-400 font-medium"
              >
                <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="flex items-center justify-between w-full">
                  AI Chat
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider border border-blue-500/20">
                    Pro
                  </span>
                </span>
              </SidebarMenuButton>

              {/* Structured AI Sub-Panel */}
              <div className="ml-3 pl-3 my-1.5 space-y-2 border-l-2 border-blue-500/20 group-data-[collapsible=icon]:hidden">
                {/* 1. New Chat Action Button */}
                <Link
                  href="/chat"
                  className={cn(
                    "flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group",
                    isExact('/chat') && !currentSessionId
                      ? "bg-blue-600 text-white shadow-xs font-semibold dark:bg-blue-500"
                      : "bg-muted/50 hover:bg-muted text-foreground border border-border/70 hover:border-border shadow-2xs"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className={cn("h-3.5 w-3.5 transition-transform group-hover:scale-110", isExact('/chat') && !currentSessionId ? "text-white" : "text-blue-500")} />
                    <span>New Chat</span>
                  </span>
                  <span className={cn("text-[10px] font-mono px-1 py-0.5 rounded", isExact('/chat') && !currentSessionId ? "bg-white/20 text-white" : "bg-background/80 text-muted-foreground border border-border/40")}>
                    ⌘K
                  </span>
                </Link>

                {/* 2. Recent Chats Section Header */}
                <div className="flex items-center justify-between px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground/60" />
                    Recent Chats
                  </span>
                  {recentChats.length > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/40">
                      {recentChats.length}
                    </span>
                  )}
                </div>

                {/* 3. Recent Chats List */}
                <div className="space-y-0.5 max-h-52 overflow-y-auto pr-0.5">
                  {recentChats.length > 0 ? (
                    recentChats.map((chat) => {
                      const isActive = currentSessionId === chat.id
                      return (
                        <div
                          key={chat.id}
                          className={cn(
                            "group/chat flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all relative",
                            isActive
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/25 shadow-2xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          )}
                        >
                          <Link
                            href={`/chat?session=${chat.id}`}
                            className="flex items-center gap-2 truncate flex-1 min-w-0"
                            title={chat.title}
                          >
                            <MessageSquare className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-colors",
                              isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/60 group-hover/chat:text-foreground"
                            )} />
                            <span className="truncate">{chat.title}</span>
                          </Link>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              deleteChatSession(chat.id)
                              if (currentSessionId === chat.id) {
                                router.push('/chat')
                              }
                            }}
                            className="opacity-0 group-hover/chat:opacity-100 p-1 rounded hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-all shrink-0"
                            title="Delete conversation"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground/50 italic text-center">
                      No conversations yet
                    </div>
                  )}
                </div>
              </div>
            </SidebarMenuItem>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton 
              render={<Link href="/sales/pos" />} 
              tooltip="Sales & POS"
              isActive={isPrefix('/sales')}
            >
              <ShoppingCart /><span>Sales & POS</span>
            </SidebarMenuButton>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton render={<Link href="/sales/pos" />} isActive={isExact('/sales/pos')}>
                  Point of Sale
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton render={<Link href="/sales/customers" />} isActive={isExact('/sales/customers')}>
                  Customers
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton render={<Link href="/sales/returns" />} isActive={isExact('/sales/returns')}>
                  Returns
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton 
              render={<Link href="/inventory/stock" />} 
              tooltip="Inventory"
              isActive={isPrefix('/inventory')}
            >
              <Package /><span>Inventory</span>
            </SidebarMenuButton>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton render={<Link href="/inventory/stock" />} isActive={isExact('/inventory/stock')}>
                  Stock Levels
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton render={<Link href="/inventory/movements" />} isActive={isExact('/inventory/movements')}>
                  Stock Entry & Ledger
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              {!isEmployee && (
                <>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/inventory/products" />} isActive={isExact('/inventory/products')}>
                      Products
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/inventory/categories" />} isActive={isExact('/inventory/categories')}>
                      Categories
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/inventory/batches" />} isActive={isExact('/inventory/batches')}>
                      Batches (Expiry)
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </>
              )}
            </SidebarMenuSub>
          </SidebarMenuItem>

          {isEmployee && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  render={<Link href="/tasks" />} 
                  tooltip="My Tasks"
                  isActive={isExact('/tasks')}
                >
                  <ListTodo /><span>My Tasks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  render={<Link href="/employees/attendance" />} 
                  tooltip="My Attendance"
                  isActive={isExact('/employees/attendance')}
                >
                  <Users /><span>My Attendance</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}

          {!isEmployee && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                render={<Link href="/purchases/orders" />} 
                tooltip="Purchases & Vendors"
                isActive={isPrefix('/purchases')}
              >
                <ArrowLeftRight /><span>Purchases</span>
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton render={<Link href="/purchases/orders" />} isActive={isExact('/purchases/orders')}>
                    Purchase Orders
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton render={<Link href="/purchases/vendors" />} isActive={isExact('/purchases/vendors')}>
                    Vendors
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          )}

          {!isEmployee && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                render={<Link href="/employees/list" />} 
                tooltip="Employees"
                isActive={isPrefix('/employees') || isExact('/tasks')}
              >
                <Users /><span>Employees</span>
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton render={<Link href="/employees/list" />} isActive={isExact('/employees/list')}>
                    Staff Directory
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton render={<Link href="/employees/attendance" />} isActive={isExact('/employees/attendance')}>
                    Attendance
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton render={<Link href="/tasks" />} isActive={isExact('/tasks')}>
                    Tasks & Operations
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {isAdmin && (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/employees/payroll" />} isActive={isExact('/employees/payroll')}>
                      Payroll
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </SidebarMenuItem>
          )}

          {isAdmin && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  render={<Link href="/expenses/ledger" />} 
                  tooltip="Financial Ledger"
                  isActive={isPrefix('/expenses')}
                >
                  <DollarSign /><span>Finance</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/expenses/ledger" />} isActive={isExact('/expenses/ledger')}>
                      Financial Ledger
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/expenses/categories" />} isActive={isExact('/expenses/categories')}>
                      Expense Categories
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/expenses/cashflow" />} isActive={isExact('/expenses/cashflow')}>
                      P&L / Cash Flow
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </>
          )}

          {!isEmployee && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                render={<Link href="/reports" />} 
                tooltip="Reports"
                isActive={isExact('/reports')}
              >
                <BarChart3 /><span>Reports</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {!isEmployee && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                render={<Link href="/radars" />} 
                tooltip="Radars"
                isActive={isPrefix('/radars')}
              >
                <Radar /><span>Radars</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t">
        <div className="flex items-center justify-around gap-1 py-1">
          {/* Theme Toggle Button */}
          <Tooltip>
            <TooltipTrigger render={
              <ThemeToggleQuick className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer" />
            } />
            <TooltipContent side="top">Theme</TooltipContent>
          </Tooltip>

          {/* Settings Button */}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer ${
                    isExact('/settings') ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  render={<Link href="/settings" />}
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              } />
              <TooltipContent side="top">Settings</TooltipContent>
            </Tooltip>
          )}

          {/* Logout Button */}
          <form action={logout}>
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/70 hover:text-red-300 hover:bg-white/10 cursor-pointer"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              } />
              <TooltipContent side="top">Logout</TooltipContent>
            </Tooltip>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
