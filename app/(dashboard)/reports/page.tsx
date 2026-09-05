import { getComprehensiveReports } from '@/app/actions/reports'
import { ReportsClient } from './reports-client'
import { redirect } from 'next/navigation'

export default async function ReportsPage() {
  const data = await getComprehensiveReports()
  if (!data) {
    redirect('/login')
  }

  return <ReportsClient data={data} />
}
