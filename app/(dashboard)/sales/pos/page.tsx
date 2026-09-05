import { getProducts } from '@/app/actions/inventory'
import { getCustomers } from '@/app/actions/sales'
import { POSClient } from './pos-client'

export default async function POSPage() {
  const [products, customers] = await Promise.all([
    getProducts(),
    getCustomers()
  ])

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Point of Sale</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Process new sales and check out customers.</p>
      </div>

      <div className="flex-1 min-h-0">
        <POSClient products={products || []} customers={customers || []} />
      </div>
    </div>
  )
}
