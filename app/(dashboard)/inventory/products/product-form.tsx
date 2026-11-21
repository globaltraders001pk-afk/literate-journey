'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct, updateProduct } from '@/app/actions/inventory'
import { Plus, Pencil } from 'lucide-react'

export function ProductForm({
  categories,
  initialData,
  canViewCost = true
}: {
  categories: Array<{ id: string; name: string }>
  initialData?: { id: string; name?: string | null; sku?: string | null; category_id?: string | null; selling_price?: number | string | null; cost_price?: number | string | null; weight?: string | null; unit?: string | null; minimum_stock_level?: number | string | null }
  canViewCost?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const isEditing = !!initialData

  async function handleSubmit(formData: FormData) {
    setPending(true)
    if (isEditing) {
      await updateProduct(initialData!.id, formData)
    } else {
      await createProduct(formData)
    }
    setPending(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={isEditing ? <Button variant="ghost" size="icon" /> : <Button />}>
        {isEditing ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update product details.' : 'Add a new product to your catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Cheddar Cheese" defaultValue={initialData?.name ?? undefined} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU / Barcode</Label>
                <Input id="sku" name="sku" placeholder="PRD-001" defaultValue={initialData?.sku ?? undefined} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category_id">Category</Label>
                <Select name="category_id" defaultValue={initialData?.category_id || undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={canViewCost ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
              <div className="grid gap-2">
                <Label htmlFor="selling_price">Selling Price (Rs)</Label>
                <Input id="selling_price" name="selling_price" type="number" step="0.01" required placeholder="10.00" defaultValue={initialData?.selling_price ?? undefined} />
              </div>
              {canViewCost ? (
                <div className="grid gap-2">
                  <Label htmlFor="cost_price">Cost Price (Rs)</Label>
                  <Input id="cost_price" name="cost_price" type="number" step="0.01" required placeholder="5.00" defaultValue={initialData?.cost_price ?? undefined} />
                </div>
              ) : (
                <input type="hidden" name="cost_price" value={initialData?.cost_price ?? "0"} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="weight">Weight / Size</Label>
                <Input id="weight" name="weight" placeholder="500g, 1kg wheel" defaultValue={initialData?.weight ?? undefined} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" name="unit" placeholder="kg, wheel, box" defaultValue={initialData?.unit ?? undefined} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minimum_stock_level">Min. Alert</Label>
                <Input id="minimum_stock_level" name="minimum_stock_level" type="number" defaultValue={initialData?.minimum_stock_level ?? "10"} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : (isEditing ? 'Update Product' : 'Save Product')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
