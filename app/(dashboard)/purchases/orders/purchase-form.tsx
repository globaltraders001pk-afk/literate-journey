'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSimplePO } from '@/app/actions/purchases'
import { Plus } from 'lucide-react'

export function PurchaseForm({ vendors, products }: { vendors: any[], products: any[] }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    await createSimplePO(formData)
    setPending(false)
    setOpen(false)
  }

  // Generated once per mount (react-hooks/purity): Math.random()
  // during render gives a different number on every render.
  const [generatedPoNumber] = useState(() => `PO-${Math.floor(1000 + Math.random() * 9000)}`)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Create PO
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Create a new purchase order for a single item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="po_number">PO Number</Label>
              <Input id="po_number" name="po_number" required defaultValue={generatedPoNumber} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor_id">Vendor</Label>
              <Select name="vendor_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product_id">Product to Order</Label>
              <Select name="product_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (${p.cost_price})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" required min="1" placeholder="10" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit_price">Unit Price (Rs)</Label>
                <Input id="unit_price" name="unit_price" type="number" step="0.01" required placeholder="5.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Send PO'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
