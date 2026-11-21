import { Suspense } from 'react'
import { getProducts, getStockLevels } from '@/app/actions/inventory'
import { truncationNote } from '@/lib/pagination'
import { getCustomers } from '@/app/actions/sales'
import { POSClient } from './pos-client'
import POSLoading from './loading'

export default function POSPage() {
  return (
    <Suspense fallback={<POSLoading />}>
      <POSDataLoader />
    </Suspense>
  )
}

async function POSDataLoader() {
  const [{ rows: products, total: productsTotal }, { rows: customers }, stockLevels] =
    await Promise.all([getProducts(), getCustomers(), getStockLevels()])
  const productsNote = truncationNote(productsTotal, products.length, 'products')
  // Current stock per product, for the cart quantity cap in POSClient.
  const stockByProduct: Record<string, number> = Object.fromEntries(
    stockLevels.map((s: { id: string; current_stock: number }) => [s.id, s.current_stock])
  )

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Point of Sale</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Process new sales and check out customers.</p>
        {productsNote && <p className="text-xs text-muted-foreground mt-1">{productsNote}</p>}
      </div>

      <div className="flex-1 min-h-0">
        <POSClient products={products} customers={customers} stockByProduct={stockByProduct} />
      </div>
    </div>
  )
}
