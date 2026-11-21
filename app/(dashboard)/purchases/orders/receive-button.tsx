'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { receivePurchaseOrder } from '@/app/actions/purchases'

export function ReceiveButton({ poId, itemId, productId, quantity }: { poId: string, itemId: string, productId: string, quantity: number }) {
  const [pending, setPending] = useState(false)

  async function handleReceive() {
    if (!confirm('Mark this purchase order as received and update inventory?')) return

    setPending(true)
    const result = await receivePurchaseOrder(poId, itemId, productId, quantity)
    setPending(false)
    if (result?.error) {
      alert(`Receive failed: ${result.error}`)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReceive} disabled={pending}>
      {pending ? 'Receiving...' : 'Receive Items'}
    </Button>
  )
}
