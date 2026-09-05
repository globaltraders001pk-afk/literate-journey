'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createExpense } from '@/app/actions/expenses'
import { Plus } from 'lucide-react'

export function ExpenseForm({ categories }: { categories: any[] }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    await createExpense(formData)
    setPending(false)
    setOpen(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Log Expense
      </DialogTrigger>
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Log Expense</DialogTitle>
            <DialogDescription>Record a new company expense to the ledger.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category_id">Category</Label>
                <Select name="category_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expense_date">Date</Label>
                <Input id="expense_date" name="expense_date" type="date" defaultValue={today} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference_number">Ref Number (Receipt #)</Label>
                <Input id="reference_number" name="reference_number" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional details..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
