import { Suspense } from 'react'
import { getComprehensiveReports } from '@/app/actions/reports'
import { ReportsClient } from './reports-client'
import { redirect } from 'next/navigation'
import ReportsLoading from './loading'

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsDataLoader />
    </Suspense>
  )
}

async function ReportsDataLoader() {
  const data = await getComprehensiveReports()
  if (!data) {
    redirect('/login')
  }

  return <ReportsClient data={data} />
}
