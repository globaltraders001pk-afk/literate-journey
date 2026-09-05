'use client'

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
import { Home, Package, ShoppingCart, Users, Settings, LogOut, DollarSign, ArrowLeftRight, Undo2, Store, BarChart3, ListTodo } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { UserRole } from '@/lib/auth-utils'
import { ThemeToggleQuick } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const isEmployee = role === 'employee'
  const isManager = role === 'manager'
  const isAdmin = role === 'admin' || role === 'owner'

  const isExact = (path: string) => pathname === path || pathname === `${path}/`
  const isPrefix = (prefix: string) => pathname.startsWith(prefix)

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center border-b px-4">
        <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Store className="h-5 w-5 shrink-0"/> Qurbat ERP
        </h2>
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

        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t">
        <div className="flex items-center justify-around gap-1 py-1">
          {/* Theme Toggle Button */}
          <Tooltip>
            <TooltipTrigger render={
              <ThemeToggleQuick className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer" />
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
                  className={`h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer ${
                    isExact('/settings') ? 'bg-primary/15 text-primary' : ''
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
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
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
