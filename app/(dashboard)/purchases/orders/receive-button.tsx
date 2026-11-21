'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { receivePurchaseOrder } from '@/app/actions/purchases'

export function ReceiveButton({ poId, itemId, productId, quantity }: { poId: string, itemId: string, productId: string, quantity: number }) {
  const [pending, setPending] = useState(false)
  // Expiry of the goods being received, when the supplier states
  // one. Left blank it stays blank: the batch stores NULL, never
  // an invented date (the old today+30d default put every receipt
  // in the URGENT band of the Expiry Radar).
  const [expiryDate, setExpiryDate] = useState('')

  async function handleReceive() {
    if (!confirm('Mark this purchase order as received and update inventory?')) return

    setPending(true)
    const result = await receivePurchaseOrder(poId, itemId, productId, quantity, expiryDate || null)
    setPending(false)
    if (result?.error) {
      alert(`Receive failed: ${result.error}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
        aria-label="Expiry date of received goods"
        title="Expiry date (optional — leave blank if not stated)"
        className="w-[150px]"
      />
      <Button variant="outline" size="sm" onClick={handleReceive} disabled={pending}>
        {pending ? 'Receiving...' : 'Receive Items'}
      </Button>
    </div>
  )
}
