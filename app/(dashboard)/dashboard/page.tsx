import { getCheeseCommandCenterData } from '@/app/actions/dashboard'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const data = await getCheeseCommandCenterData()

  return <DashboardClient data={data} />
}
