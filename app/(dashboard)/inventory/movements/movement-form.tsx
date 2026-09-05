'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createMovement } from '@/app/actions/inventory'
import { Plus } from 'lucide-react'

export function MovementForm({ products }: { products: any[] }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    await createMovement(formData)
    setPending(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Record Movement
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Inventory Movement</DialogTitle>
            <DialogDescription>Manually adjust stock for a product.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product_id">Product</Label>
              <Select name="product_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id}>{prod.name} ({prod.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="movement_type">Movement Type</Label>
                <Select name="movement_type" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opening_stock">Opening Stock</SelectItem>
                    <SelectItem value="purchase">Purchase (In)</SelectItem>
                    <SelectItem value="sale">Sale (Out)</SelectItem>
                    <SelectItem value="damaged">Damaged (Out)</SelectItem>
                    <SelectItem value="expired">Expired (Out)</SelectItem>
                    <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity (Absolute)</Label>
                <Input id="quantity" name="quantity" type="number" required min="1" placeholder="e.g. 10" />
                <p className="text-xs text-muted-foreground">Enter as positive number. It will be subtracted if type is Out.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Reason for adjustment" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Record Movement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
