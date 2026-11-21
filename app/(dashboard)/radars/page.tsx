import { Suspense } from 'react'
import { checkAccess } from '@/lib/auth-utils'
import { getRadarsBundle } from '@/app/actions/radars'
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

  // One bundle: batches and stock are fetched once and shared
  // between the tabs (M8) instead of being loaded twice.
  const { expiry, stock, inventory, vendors } = await getRadarsBundle()

  return (
    <RadarsClient expiry={expiry} stock={stock} inventory={inventory} vendors={vendors} />
  )
}
