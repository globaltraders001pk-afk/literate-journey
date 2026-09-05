import { checkAccess } from '@/lib/auth-utils'
import { ReactNode } from 'react'

export default async function EmployeesLayout({ children }: { children: ReactNode }) {
  await checkAccess(['admin', 'owner', 'manager', 'employee'])
  return <>{children}</>
}
