'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createExpenseCategory, updateExpenseCategory } from '@/app/actions/expenses'
import { Pencil, Plus } from 'lucide-react'

type Category = { id: string; name: string; description: string | null }

// One form, two modes: no `category` prop creates, a `category` prop edits it.
export function CategoryForm({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const isEdit = !!category

  async function handleSubmit(formData: FormData) {
    setPending(true)
    if (isEdit) {
      await updateExpenseCategory(category.id, formData)
    } else {
      await createExpenseCategory(formData)
    }
    setPending(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer" title="Edit category">
            <Pencil className="h-4 w-4" />
          </Button>
        } />
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </DialogTrigger>
      )}
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Expense Category' : 'Add Expense Category'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the classification for company expenses.' : 'Create a new classification for company expenses.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Utility Bills, Rent, Maintenance" defaultValue={category?.name ?? ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" defaultValue={category?.description ?? ''} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
