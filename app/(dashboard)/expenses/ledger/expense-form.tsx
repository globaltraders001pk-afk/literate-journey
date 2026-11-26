'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createExpense, updateExpense } from '@/app/actions/expenses'
import { Pencil, Plus } from 'lucide-react'

type Expense = {
  id: string
  category_id: string
  amount: number | string
  expense_date: string
  reference_number: string | null
  notes: string | null
}

// One form, two modes: no `expense` prop logs a new expense, an
// `expense` prop edits it — including moving it to another category.
export function ExpenseForm({ categories, expense }: { categories: Array<{ id: string; name: string }>; expense?: Expense }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const isEdit = !!expense

  async function handleSubmit(formData: FormData) {
    setPending(true)
    if (isEdit) {
      await updateExpense(expense.id, formData)
    } else {
      await createExpense(formData)
    }
    setPending(false)
    setOpen(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer" title="Edit expense">
            <Pencil className="h-4 w-4" />
          </Button>
        } />
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus className="mr-2 h-4 w-4" />
          Log Expense
        </DialogTrigger>
      )}
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Expense' : 'Log Expense'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the recorded expense. Changing its category moves it to the new category.' : 'Record a new company expense to the ledger.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category_id">Category</Label>
                <Select name="category_id" required defaultValue={expense?.category_id}>
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
                <Label htmlFor="amount">Amount (Rs)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={expense?.amount ?? ''} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expense_date">Date</Label>
                <Input id="expense_date" name="expense_date" type="date" defaultValue={expense ? String(expense.expense_date).slice(0, 10) : today} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference_number">Ref Number (Receipt #)</Label>
                <Input id="reference_number" name="reference_number" defaultValue={expense?.reference_number ?? ''} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional details..." defaultValue={expense?.notes ?? ''} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
