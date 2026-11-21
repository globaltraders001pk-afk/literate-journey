'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createCategory, updateCategory } from '@/app/actions/inventory'
import { Plus, Pencil } from 'lucide-react'

export function CategoryForm({ initialData }: { initialData?: { id: string; name?: string; description?: string } }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const isEditing = !!initialData

  async function handleSubmit(formData: FormData) {
    setPending(true)
    if (isEditing) {
      await updateCategory(initialData!.id, formData)
    } else {
      await createCategory(formData)
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
            Add Category
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update your product category details.' : 'Create a new product category here. Click save when you\'re done.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Dairy" defaultValue={initialData?.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional description" defaultValue={initialData?.description} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : (isEditing ? 'Update Category' : 'Save Category')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
