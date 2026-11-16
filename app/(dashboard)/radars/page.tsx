import { Suspense } from 'react'
import { checkAccess } from '@/lib/auth-utils'
import {
  getExpiryRadar,
  getStockRadar,
  getInventoryRadar,
  getVendorsRadar,
} from '@/app/actions/radars'
import { RadarsClient } from './radars-client'
import RadarsLoading from './loading'

export default function RadarsPage() {
  return (
    <Suspense fallback={<RadarsLoading />}>
      <RadarsDataLoader />
    </Suspense>
  )
}

async function RadarsDataLoader() {
  // Radars are for owner / admin / manager only.
  await checkAccess(['owner', 'admin', 'manager'])

  const [expiry, stock, inventory, vendors] = await Promise.all([
    getExpiryRadar(),
    getStockRadar(),
    getInventoryRadar(),
    getVendorsRadar(),
  ])

  return (
    <RadarsClient expiry={expiry} stock={stock} inventory={inventory} vendors={vendors} />
  )
}
