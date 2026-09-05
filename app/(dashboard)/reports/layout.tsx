import { checkAccess } from '@/lib/auth-utils'
import { ReactNode } from 'react'

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await checkAccess(['admin', 'owner', 'manager'])
  return <>{children}</>
}
