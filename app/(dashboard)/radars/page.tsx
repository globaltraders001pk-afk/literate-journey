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
  // between the tabs (M8) instead of being loaded twice. Each radar
  // settles on its own (M4): a failed tab comes back as null +
  // an error string, and the client renders an error state with
  // retry for that tab instead of the whole page crashing.
  const bundle = await getRadarsBundle()

  return <RadarsClient bundle={bundle} />
}
