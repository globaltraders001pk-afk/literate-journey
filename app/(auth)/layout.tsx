import { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-muted/30 p-4 transition-colors">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
