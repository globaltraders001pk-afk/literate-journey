'use client'

// Error boundary for the whole (dashboard) segment (QA audit M4):
// before this, one failed query took down the entire page with the
// Next.js default error screen. This shows what failed and retries
// the segment. Per-radar failures are handled closer to the data —
// the /radars tabs render their own error state with retry — so
// this only fires for whole-page failures (auth, layout, loader).
//
// Props follow this repo's installed Next.js docs
// (node_modules/next/dist/docs/.../error.md): `retry`, not `reset`.
import { useEffect } from 'react'

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          This page could not be loaded. {error.message || 'Please try again.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}
