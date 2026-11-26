'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteProduct } from '@/app/actions/inventory'
import { Trash2 } from 'lucide-react'

export function DeleteProductButton({ productId, productName }: { productId: string, productName: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleDelete = async () => {
    setPending(true)
    const result = await deleteProduct(productId)
    setPending(false)
    setOpen(false)
    if (result?.error) {
      alert(`Error: ${result.error}`)
    } else if (result?.message) {
      // Soft delete: the product stays in history as Inactive and
      // leaves the default (active-only) list — say so plainly.
      alert(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer" title="Delete product">
          <Trash2 className="h-4 w-4" />
        </Button>
      } />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove <span className="font-semibold text-foreground">{productName}</span>?
            If this product has existing sales or stock movements, it will be safely deactivated to preserve historical reporting.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex sm:justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
