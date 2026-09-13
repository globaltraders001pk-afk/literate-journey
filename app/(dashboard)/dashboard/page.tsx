import { Suspense } from 'react'
import { getCheeseCommandCenterData } from '@/app/actions/dashboard'
import { DashboardClient } from './dashboard-client'
import DashboardLoading from './loading'

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardDataLoader />
    </Suspense>
  )
}

async function DashboardDataLoader() {
  const data = await getCheeseCommandCenterData()
  return <DashboardClient data={data} />
}
