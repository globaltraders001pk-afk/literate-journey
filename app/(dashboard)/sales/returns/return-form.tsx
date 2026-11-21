'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { processReturn } from '@/app/actions/returns'
import { Undo2 } from 'lucide-react'

export function ReturnForm({ products, customers }: { products: Array<{ id: string; name: string }>, customers: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    const product_id = formData.get('product_id') as string
    const customer_id = formData.get('customer_id') as string
    const quantity = parseInt(formData.get('quantity') as string)
    const refund_amount = parseFloat(formData.get('refund_amount') as string)
    const return_action = formData.get('return_action') as string

    const result = await processReturn(
      '', // We omit sale_id for this simple manual return flow
      customer_id && customer_id !== 'none' ? customer_id : null,
      [{ product_id, quantity, return_action, refund_amount }]
    )

    setPending(false)
    if (result.success) {
      setOpen(false)
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Undo2 className="mr-2 h-4 w-4" />
        Process Return
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>Process a customer return and specify how to handle the inventory.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customer_id">Customer (Optional)</Label>
              <Select name="customer_id">
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Walk-in Customer</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="product_id">Product Returned</Label>
              <Select name="product_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" required min="1" defaultValue="1" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="refund_amount">Refund Amount (Rs)</Label>
                <Input id="refund_amount" name="refund_amount" type="number" step="0.01" required placeholder="0.00" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="return_action">Inventory Action</Label>
              <Select name="return_action" required defaultValue="restock">
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock (Good Condition)</SelectItem>
                  <SelectItem value="damage">Mark as Damaged</SelectItem>
                  <SelectItem value="discard">Discard / Waste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Processing...' : 'Complete Return'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
