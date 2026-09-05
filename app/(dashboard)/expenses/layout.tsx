import { checkAccess } from '@/lib/auth-utils'
import { ReactNode } from 'react'

export default async function ExpensesLayout({ children }: { children: ReactNode }) {
  await checkAccess(['admin', 'owner'])
  return <>{children}</>
}
