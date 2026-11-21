'use client'

// Error boundary for the root segment (QA audit follow-up):
// app/(dashboard)/error.tsx only covers the dashboard group, so
// /login and the other non-dashboard segments crashed bare with
// the Next.js default error screen. This shows what failed and
// retries the segment, same pattern as the dashboard boundary.
//
// Props follow this repo's installed Next.js docs
// (node_modules/next/dist/docs/.../error.md): `retry`, not `reset`.
import { useEffect } from 'react'

export default function RootError({
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
    <div className="flex min-h-screen items-center justify-center p-6">
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
    </div>
  )
}
