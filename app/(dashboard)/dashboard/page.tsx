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
  // The radar summary now rides along with the command-center
  // data: it is computed from the same stock + batches fetch, so
  // the dashboard no longer loads both datasets twice (M8).
  // Employees get radarSummary null (see dashboard.ts).
  return <DashboardClient data={data} radarSummary={data.radarSummary} />
}
