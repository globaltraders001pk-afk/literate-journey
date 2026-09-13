import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Palette, Building2, Sun, Moon, Laptop, Upload, Pencil } from 'lucide-react'

export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Settings & System Configuration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage branding, logos, store preferences, and appearance theme.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Card 1: Appearance & Theme */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground/60" />
              <CardTitle>Appearance & Theme</CardTitle>
            </div>
            <CardDescription>
              Customize how Qurbat ERP looks on your device. Choose between light, dark, or system preference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Light Theme Card */}
              <div className="p-4 rounded-xl border-2 border-border/60 space-y-2">
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
                </div>
              </div>

              {/* Dark Theme Card */}
              <div className="p-4 rounded-xl border-2 border-border/60 space-y-2">
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
                </div>
              </div>

              {/* System Theme Card */}
              <div className="p-4 rounded-xl border-2 border-border/60 space-y-2">
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
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Currently active appearance</p>
                <Skeleton className="h-3.5 w-56 rounded mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 px-3 rounded-md border text-xs font-medium flex items-center gap-1">
                  <Sun className="h-3.5 w-3.5 text-amber-500" /> Light
                </div>
                <div className="h-8 px-3 rounded-md border text-xs font-medium flex items-center gap-1">
                  <Moon className="h-3.5 w-3.5 text-emerald-400" /> Dark
                </div>
                <div className="h-8 px-3 rounded-md border text-xs font-medium flex items-center gap-1">
                  <Laptop className="h-3.5 w-3.5" /> System
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Business Branding & Dynamic Logo */}
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/20 border-b">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Business Branding & Dynamic Logo</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Upload your business's official logo. When changed, it updates across the entire system instantly—including the sidebar, POS receipts, and invoices.
              </CardDescription>
            </div>
            <Badge variant="default" className="bg-emerald-600 text-[11px] py-1 shrink-0">
              Owner Managed
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Logo Preview Section */}
              <div className="lg:col-span-4 flex flex-col items-center sm:items-start space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Brand Logo
                </span>
                <div className="w-44 h-44 rounded-2xl border-2 border-border/80 p-3 bg-muted/20 flex flex-col items-center justify-center shadow-xs">
                  <Skeleton className="h-16 w-16 rounded-2xl" />
                  <Skeleton className="h-3 w-24 rounded mt-3" />
                </div>
                <div className="w-full max-w-44 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Status:</span>
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                </div>
              </div>

              {/* Upload Zone */}
              <div className="lg:col-span-8 space-y-4">
                <div className="border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center bg-muted/10">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Click to upload or drag & drop business logo
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Supports high-resolution PNG, JPG, SVG, or WEBP (transparent background recommended, max 5MB)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Organization Details */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Organization Information</CardTitle>
              </div>
              <CardDescription>
                Company settings, contact credentials, and official headquarters address.
              </CardDescription>
            </div>
            <div className="h-8 px-3 rounded-md border flex items-center gap-1.5 text-xs font-medium">
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-border/50 space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase">Business Name</span>
                <Skeleton className="h-4 w-40 rounded" />
              </div>
              <div className="p-3 rounded-lg border border-border/50 space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase">Contact Phone</span>
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="p-3 rounded-lg border border-border/50 space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase">Business Email</span>
                <Skeleton className="h-4 w-48 rounded" />
              </div>
              <div className="p-3 rounded-lg border border-border/50 space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase">Main Address</span>
                <Skeleton className="h-4 w-52 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
