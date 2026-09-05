'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createExpenseCategory } from '@/app/actions/expenses'
import { Plus } from 'lucide-react'

export function CategoryForm() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    await createExpenseCategory(formData)
    setPending(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Category
      </DialogTrigger>
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
            <DialogDescription>Create a new classification for company expenses.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Utility Bills, Rent, Maintenance" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
