import { Suspense } from 'react'
import { getCheeseCommandCenterData } from '@/app/actions/dashboard'
import { getRadarSummary } from '@/app/actions/radars'
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
  // Radar summary only for roles that can open /radars (owner/admin/manager).
  const radarSummary =
    data.role === 'employee' ? null : await getRadarSummary()
  return <DashboardClient data={data} radarSummary={radarSummary} />
}
