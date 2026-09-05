'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateOrganization } from '@/app/actions/organization'
import { 
  Sun, 
  Moon, 
  Laptop, 
  Check, 
  Palette, 
  Building2, 
  Store, 
  Pencil, 
  Loader2, 
  Phone, 
  Mail, 
  MapPin, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react'

export function SettingsClient({ 
  organization, 
  isOwner = false 
}: { 
  organization: any; 
  isOwner?: boolean 
}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  async function handleUpdateOrg(formData: FormData) {
    setPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const res = await updateOrganization(formData)
    setPending(false)

    if (res?.error) {
      setErrorMessage(res.error)
    } else {
      setSuccessMessage('Organization information updated successfully.')
      setOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Theme & Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Appearance & Theme</CardTitle>
          </div>
          <CardDescription>
            Customize how Qurbat ERP looks on your device. Choose between light, dark, or system preference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Mode Card */}
            <div
              onClick={() => setTheme('light')}
              className={`group relative flex flex-col items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mounted && theme === 'light'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="w-full space-y-2">
                <div className="h-20 w-full rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-slate-300 rounded" />
                    <div className="h-2 w-4 bg-slate-300 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-slate-400 rounded" />
                    <div className="h-2 w-20 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-sm">Light Mode</span>
                  </div>
                  {mounted && theme === 'light' && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Dark Mode Card */}
            <div
              onClick={() => setTheme('dark')}
              className={`group relative flex flex-col items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mounted && theme === 'dark'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="w-full space-y-2">
                <div className="h-20 w-full rounded-lg bg-zinc-900 border border-zinc-700 p-2.5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-zinc-700 rounded" />
                    <div className="h-2 w-4 bg-zinc-700 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-zinc-500 rounded" />
                    <div className="h-2 w-20 bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-sm">Dark Mode</span>
                  </div>
                  {mounted && theme === 'dark' && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* System Preference Card */}
            <div
              onClick={() => setTheme('system')}
              className={`group relative flex flex-col items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mounted && theme === 'system'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="w-full space-y-2">
                <div className="h-20 w-full rounded-lg bg-gradient-to-r from-slate-100 to-zinc-900 border border-border p-2.5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-slate-400 rounded" />
                    <div className="h-2 w-4 bg-slate-300 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-slate-500 rounded" />
                    <div className="h-2 w-20 bg-zinc-600 rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">System Theme</span>
                  </div>
                  {mounted && theme === 'system' && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Currently active appearance</p>
              <p className="text-xs text-muted-foreground">
                {mounted ? (
                  <>
                    Rendering in <strong className="capitalize">{resolvedTheme}</strong> mode (preference:{' '}
                    <strong className="capitalize">{theme}</strong>)
                  </>
                ) : (
                  'Synchronizing theme...'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={mounted && theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-3.5 w-3.5 mr-1 text-amber-500" />
                Light
              </Button>
              <Button
                variant={mounted && theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                Dark
              </Button>
              <Button
                variant={mounted && theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Laptop className="h-3.5 w-3.5 mr-1" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Details */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Organization Information</CardTitle>
            </div>
            <CardDescription>
              Company settings and branch information.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <Dialog 
                open={open} 
                onOpenChange={(val) => {
                  setOpen(val)
                  if (val) {
                    setErrorMessage(null)
                    setSuccessMessage(null)
                  }
                }}
              >
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Details
                </DialogTrigger>
                <DialogContent className="max-w-md sm:max-w-md">
                  <form action={handleUpdateOrg}>
                    <DialogHeader>
                      <DialogTitle>Edit Organization Information</DialogTitle>
                      <DialogDescription>
                        Update your business credentials, contact phone, and official address.
                      </DialogDescription>
                    </DialogHeader>

                    {errorMessage && (
                      <div className="my-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Business Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="name"
                          name="name"
                          required
                          placeholder="e.g. Qurbat Restaurant & Management"
                          defaultValue={organization?.name || ''}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="phone">Contact Phone</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+92 (300) 123-4567"
                          defaultValue={organization?.phone || ''}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="email">Business Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="admin@qurbat-erp.com"
                          defaultValue={organization?.email || ''}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="address">Main Address</Label>
                        <Input
                          id="address"
                          name="address"
                          placeholder="Main Commercial Area, Sector B"
                          defaultValue={organization?.address || ''}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={pending}>
                        {pending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <Badge variant="secondary" className="text-xs text-muted-foreground font-normal">
                Owner Managed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="p-3 text-xs rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Business Name</span>
              <p className="font-semibold text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                {organization?.name || 'Qurbat Restaurant & Management'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Contact Phone</span>
              <p className="font-medium text-sm flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {organization?.phone || '+92 (300) 123-4567'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Business Email</span>
              <p className="font-medium text-sm flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {organization?.email || 'admin@qurbat-erp.com'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Main Address</span>
              <p className="font-medium text-sm flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {organization?.address || 'Main Commercial Area, Sector B'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
