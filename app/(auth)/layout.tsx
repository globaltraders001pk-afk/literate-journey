import { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ExpensiveAmbientMesh } from '@/components/expensive-ambient-mesh'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden transition-colors">
      {/* Luxury Ambient Aurora & Precision Grid */}
      <ExpensiveAmbientMesh showBeam={false} />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
