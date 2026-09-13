import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardRootLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Header Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/40">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <Skeleton className="h-8 w-36 rounded-lg self-start sm:self-auto" />
      </div>

      {/* 2. Quick Actions Skeletons */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg ml-auto" />
      </div>

      {/* 3. 4 KPI Overview Cards Skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white/90 via-emerald-50/50 to-teal-50/40 dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-cyan-950/20 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
        ))}
      </div>

      {/* 4. Main Two-Column Layout Skeletons */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white/90 via-emerald-50/50 to-teal-50/40 dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-cyan-950/20 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-60 rounded-md" />
              </div>
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
            {/* Chart Bars Skeleton */}
            <div className="h-44 flex items-end justify-between gap-3 pt-4 border-b border-border/40 pb-2">
              {[40, 65, 30, 85, 50, 95, 45].map((h, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <Skeleton className="w-full max-w-[40px] rounded-t-md" style={{ height: `${h}%` }} />
                  <Skeleton className="h-3 w-8 rounded" />
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 pt-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white/90 via-emerald-50/50 to-teal-50/40 dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-cyan-950/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-48 rounded-md" />
              </div>
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
            <div className="space-y-3 pt-2">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32 rounded" />
                      <Skeleton className="h-2.5 w-48 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Span 1) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white/90 via-emerald-50/50 to-teal-50/40 dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-cyan-950/20 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white/90 via-emerald-50/50 to-teal-50/40 dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-cyan-950/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
